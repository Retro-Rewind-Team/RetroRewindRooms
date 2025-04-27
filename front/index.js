function makeSpan(contents, classname) {
    const span = document.createElement("span");
    span.innerHTML = contents;

    if (classname)
        span.classList.add(classname);

    return span;
}

function makeTd(contents, classname) {
    const td = document.createElement("td");
    td.textContent = contents;

    if (classname)
        td.classList.add(classname);

    return td;
}

function makeTh(contents) {
    const th = document.createElement("th");
    th.innerHTML = contents;
    return th;
}

function pad(num, size) {
    num = num.toString();
    while (num.length < size)
        num = "0" + num;

    return num;
}

function formatUptime(startDate, endDate) {
    var timeDiff = endDate.getTime() - startDate.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    timeDiff -= hours * (1000 * 60 * 60);

    const mins = Math.floor(timeDiff / (1000 * 60));
    timeDiff -= mins * (1000 * 60);

    const seconds = Math.floor(timeDiff / (1000));
    timeDiff -= seconds * (1000);

    return `${pad(hours, 2)}:${pad(mins, 2)}:${pad(seconds, 2)}`;
}

var roomUpSpans = [];
const miiByFc = {};
var maxId;
var currentId;
var minId;
const json_by_id = {};

async function getMiisForPlayerInfo(playerInfo) {
    function isEmpty(obj) {
        for (const prop in obj)
            if (Object.hasOwn(obj, prop))
                return false;

        return true;
    }

    function makeImg(imgb64) {
        const img = document.createElement("img");
        img.src = `data:image/png;base64,${imgb64}`;
        img.classList.add("mii");

        return img;
    }

    const miiTds = playerInfo.querySelectorAll(".mii");
    const reqBody = {};

    for (const miiTd of miiTds) {
        const miiFromFc = miiByFc[miiTd.dataset.fc];

        if (miiFromFc) {
            miiTd.append(makeImg(miiFromFc));
            continue;
        }

        reqBody[miiTd.dataset.fc] = miiTd.dataset.miiData;
    }

    if (isEmpty(reqBody))
        return;

    const response = await fetch("./qrcoderc24", {
        method: "POST",
        body: JSON.stringify(reqBody),
        headers: {
            "Content-type": "application/json; charset=UTF-8",
        }
    });

    if (!response.ok)
        return;

    const json = await response.json();

    if (!json)
        return;

    for (const miiTd of miiTds) {
        const miiData = json[miiTd.dataset.fc];

        if (miiData) {
            miiByFc[miiTd.dataset.fc] = miiData;
            miiTd.append(makeImg(miiData));
        }
    }
}

function makePlayer(player, priv) {
    const tr = document.createElement("tr");
    tr.classList.add("player-row");

    if (player.mii && player.mii[0]) {
        const miiTd = document.createElement("td");
        miiTd.classList.add("mii");
        miiTd.dataset.fc = player.fc;
        miiTd.dataset.miiData = player.mii[0].data;
        tr.append(miiTd);
        tr.append(makeTd(player.mii[0].name));
    }
    else {
        tr.append(makeTd(""));
        tr.append(makeTd(player.name));
    }
    tr.append(makeTd(player.fc));
    tr.append(makeTd(player.ev ? player.ev : "??"));
    tr.append(makeTd(player.eb ? player.eb : "??"));

    if (!priv) {
        let ohtd;
        if (player.openhost == "true")
            ohtd = makeTd("✓", "oh-true");
        else
            ohtd = makeTd("✗", "oh-false");

        ohtd.style.fontFamily = "'JetBrains Mono', sans-serif";
        tr.append(ohtd);
    }

    return tr;
}

function makePlayerInfo(players, priv) {
    var playerCount = 0;

    const table = document.createElement("table");
    const tHead = document.createElement("thead");
    const tHeadTr = document.createElement("tr");
    tHeadTr.append(makeTh("Mii"));
    tHeadTr.append(makeTh("Name"));
    tHeadTr.append(makeTh("Friend Code"));
    tHeadTr.append(makeTh("VR"));
    tHeadTr.append(makeTh("BR"));
    if (!priv)
        tHeadTr.append(makeTh("OH"));
    tHead.append(tHeadTr);
    table.append(tHead);
    const tBody = document.createElement("tbody");
    table.append(tBody);

    for (const id in players) {
        tBody.append(makePlayer(players[id], priv));
        playerCount++;
    }

    return [table, playerCount];
}

function makeRoom(room) {
    const isPublic = room.type == "anybody";

    const roomInfo = document.createElement("h3");
    roomInfo.classList.add("room-info");

    const [playerInfo, playerCount] = makePlayerInfo(room.players, !isPublic);
    getMiisForPlayerInfo(playerInfo);

    var roomType;

    if (room.rk == "vs_10" || room.rk == "vs_751")
        roomType = "VS";
    else if (room.rk == "vs_11")
        roomType = "TT";
    else
        roomType = "??";

    // room.type is actually the access: public or private
    roomInfo.append(makeSpan(isPublic ? "Public" : "Private", isPublic ? "public" : "private"));
    roomInfo.append(makeSpan(" "));
    roomInfo.append(makeSpan(`${roomType == "??" ? "" : roomType} Room`));
    roomInfo.append(makeSpan(" - "));
    roomInfo.append(makeSpan("Up "));

    const dateCreated = new Date(room.created);
    const upSpan = document.createElement("span");
    upSpan.dataset.created = dateCreated;
    upSpan.innerHTML = formatUptime(dateCreated, currentId == maxId ? new Date(Date.now()) : new Date(json_by_id[currentId].timestamp));
    upSpan.classList.add("upspan");
    roomUpSpans.push(upSpan);

    roomInfo.append(upSpan);
    roomInfo.append(makeSpan(" - "));
    roomInfo.append(makeSpan(`${room.id}`, "room-id"));
    roomInfo.append(document.createElement("br"));
    roomInfo.append(makeSpan(`${playerCount} ${playerCount == 1 ? "Player" : "Players"}`, "players"));
    roomInfo.append(makeSpan(" - "));
    const joinable = playerCount != 12;
    roomInfo.append(makeSpan(`${joinable ? "Joinable" : "Not Joinable"}`, joinable ? "joinable" : "not-joinable"));

    if (room.averageVR > 0) {
        roomInfo.append(makeSpan(" - "));
        roomInfo.append(makeSpan(`${room.averageVR} VR Avg`, "avg-vr"));
        // roomInfo.append(makeSpan(" VR Avg"));
    }

    return [roomInfo, playerInfo, playerCount];
}

async function update(json) {
    if (!json)
        return;

    const hasData = !!json.rooms;

    const div = document.querySelector("div.scroll");
    while (div.children.length > 0)
        div.removeChild(div.lastChild);

    roomUpSpans = [];

    var playerCount = 0;
    var roomCount = 0;

    if (hasData) {
        for (const room of json.rooms) {
            const [roomInfo, playerInfo, roomPlayerCount] = makeRoom(room);
            div.append(roomInfo);
            div.append(playerInfo);

            const hrDiv = document.createElement("div");
            const hr = document.createElement("hr");
            hr.classList.add("no-margin-top");
            hrDiv.append(hr);
            div.append(hrDiv);

            playerCount += roomPlayerCount;
            roomCount++;
        }
    }
    else {
        const hrDiv = document.createElement("div");
        hrDiv.append(document.createElement("hr"));
        div.append(hrDiv);
    }

    const pce = document.getElementById("player-count");
    pce.innerHTML = hasData ? playerCount : "??";

    const rce = document.getElementById("room-count");
    rce.innerHTML = hasData ? roomCount : "??";

    document.getElementById("no-data").style.display = hasData ? "none" : "";

    if (playerCount > 100) {
        pce.parentElement.classList.add("excited");
        rce.parentElement.classList.add("excited");
    }
    else {
        pce.parentElement.classList.remove("excited");
        rce.parentElement.classList.remove("excited");
    }

    const date = new Date(json.timestamp);
    document.getElementById("fetch-timestamp").innerHTML = `Data ID ${currentId} Fetched At ${pad(date.getHours(), 2)}:${pad(date.getMinutes(), 2)}:${pad(date.getSeconds(), 2)}`;
}

async function getRooms(id) {
    // TODO: This function sucks
    function updateButtons(disableBack) {
        const forwards = document.getElementById("forwards");
        const megaForwards = document.getElementById("mega-forwards");
        const backwards = document.getElementById("backwards");
        const megaBackwards = document.getElementById("mega-backwards");

        if (currentId == maxId) {
            forwards.classList.remove("active");
            megaForwards.classList.remove("active");
        }

        if (currentId == minId || disableBack) {
            backwards.classList.remove("active");
            megaBackwards.classList.remove("active");
        }

        if (currentId != maxId) {
            forwards.classList.add("active");
            megaForwards.classList.add("active");
        }

        if (currentId != minId && !disableBack) {
            backwards.classList.add("active");
            megaBackwards.classList.add("active");
        }
    }

    console.log(`fetching rooms with ${id != null ? `id ${id}` : "the latest id"}`);

    if (id && typeof id === "number") {
        const json = json_by_id[id];

        if (json) {
            currentId = json.id;
            updateButtons();

            return json;
        }
    }

    const req = await fetch(`./groups${id != null ? `?id=${id}` : ""}`);

    if (!req.ok) {
        updateButtons(true);
        return null; // TODO: Handle error
    }

    const json = await req.json();

    if (!json)
        return null;

    json_by_id[json.id] = json;
    minId = json.minimum_id;

    if (currentId == maxId || id != null)
        currentId = json.id;

    if (id == null)
        maxId = json.id;

    updateButtons();

    return json;
}

// eslint-disable-next-line no-unused-vars
async function forwards(mega) {
    if (mega && currentId != maxId)
        update(await getRooms(maxId));
    else if (currentId + 1 <= maxId)
        update(await getRooms(currentId + 1));
}

// eslint-disable-next-line no-unused-vars
async function backwards(mega) {
    const realMin = Math.min(minId, maxId - Object.keys(json_by_id).length + 1);

    if (mega && currentId != realMin) {
        // Sometimes the minId can become desynced with the server, to avoid
        // this, just send "min" instead of requesting an explicit ID, and the
        // server will handle it
        update(await getRooms(minId <= realMin ? "min" : realMin));
    }
    else if (currentId - 1 >= realMin)
        update(await getRooms(currentId - 1));
}

// eslint-disable-next-line no-unused-vars
async function init() {
    update(await getRooms());
}

// 1 minute
setInterval(async () => {
    const json = await getRooms();

    // If you're not on the most curren page, you don't get whisked away
    if (currentId == maxId)
        update(json);
}, 60000);

setInterval(() => {
    if (currentId != maxId)
        return;

    if (!roomUpSpans)
        return;

    for (const idx in roomUpSpans) {
        const span = roomUpSpans[idx];
        span.innerHTML = formatUptime(new Date(span.dataset.created), new Date(Date.now()));
    }
}, 1000);
