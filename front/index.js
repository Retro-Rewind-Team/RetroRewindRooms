function makeSpan(contents, classname) {
    var span = document.createElement("span");
    span.innerHTML = contents;

    if (classname)
        span.classList.add(classname);

    return span;
}

function makeTd(contents) {
    var td = document.createElement("td");
    td.innerHTML = contents;
    return td;
}

function makeTh(contents) {
    var th = document.createElement("th");
    th.innerHTML = contents;
    return th;
}

var miiByFc = {};

async function getMiisForPlayerInfo(playerInfo) {
    function makeImg(mii) {
        var miiImageUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${mii}&type=face&expression=normal&width=270&bgColor=FFFFFF00&clothesColor=default&cameraXRotate=0&cameraYRotate=0&cameraZRotate=0&characterXRotate=0&characterYRotate=0&characterZRotate=0&lightDirectionMode=none&instanceCount=1&instanceRotationMode=model`;

        var img = document.createElement("img");
        img.src = miiImageUrl;
        img.classList.add("mii");

        return img;
    }

    var miiTds = playerInfo.querySelectorAll(".mii");
    var reqBody = {};

    for (var miiTd of miiTds) {
        var miiFromFc = miiByFc[miiTd.dataset.fc];

        if (miiFromFc) {
            miiTd.append(makeImg(miiFromFc));
            continue;
        }

        reqBody[miiTd.dataset.fc] = miiTd.dataset.miiData;
    }

    var response = await fetch("./qrcoderc24", {
        method: "POST",
        body: JSON.stringify(reqBody),
        headers: {
            "Content-type": "application/json; charset=UTF-8",
        }
    });

    if (!response.ok)
        return;

    var json = await response.json();

    if (!json)
        return;

    for (var miiTd of miiTds) {
        var miiData = json[miiTd.dataset.fc];

        if (miiData)
            miiTd.append(makeImg(miiData));
    }
}

function makePlayer(player) {
    var tr = document.createElement("tr");
    tr.classList.add("player-row");

    if (player.mii && player.mii[0]) {
        var miiTd = document.createElement("td");
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

    return tr;
}

function makePlayerInfo(players) {
    var playerCount = 0;

    var table = document.createElement("table");
    var tHead = document.createElement("thead");
    var tHeadTr = document.createElement("tr");
    tHeadTr.append(makeTh("Mii"));
    tHeadTr.append(makeTh("Name"));
    tHeadTr.append(makeTh("Friend Code"));
    tHeadTr.append(makeTh("VR"));
    tHead.append(tHeadTr);
    table.append(tHead);
    var tBody = document.createElement("tbody");
    table.append(tBody);

    for (var id in players) {
        tBody.append(makePlayer(players[id]));
        playerCount++;
    }

    return [table, playerCount];
}

function makeRoom(room) {
    function pad(num, size) {
        num = num.toString();
        while (num.length < size)
            num = "0" + num;

        return num;
    }

    var roomInfo = document.createElement("h3");
    roomInfo.classList.add("room-info");

    var [playerInfo, playerCount] = makePlayerInfo(room.players);
    getMiisForPlayerInfo(playerInfo);

    var roomType;

    if (!room.rk)
        roomType = "??";
    else
        roomType = room.rk == "vs_10" ? "VS" : "TT";

    // room.type is actually the access: public or private
    roomInfo.append(makeSpan((room.type == "anybody" ? "Public" : "Private") + " "));
    roomInfo.append(makeSpan(`${roomType == "??" ? "" : roomType} Room`));

    var timeDiff = Date.now() - new Date(room.created).getTime();
    var hours = Math.floor(timeDiff / (1000 * 60 * 60));
    timeDiff -= hours * (1000 * 60 * 60);

    var mins = Math.floor(timeDiff / (1000 * 60));
    timeDiff -= mins * (1000 * 60);

    var seconds = Math.floor(timeDiff / (1000));
    timeDiff -= seconds * (1000);

    roomInfo.append(makeSpan(` - Uptime: ${pad(hours, 2)}:${pad(mins, 2)}:${pad(seconds, 2)}`));
    roomInfo.append(makeSpan(` - ${room.id}`));
    roomInfo.append(document.createElement("br"));
    roomInfo.append(makeSpan(`${playerCount} ${playerCount == 1 ? "Player - " : "Players - "}`));
    var joinable = playerCount != 12;
    roomInfo.append(makeSpan(`${joinable ? "Joinable" : "Not Joinable"}`, joinable ? "joinable" : "not-joinable"));

    return [roomInfo, playerInfo, playerCount];
}

// eslint-disable-next-line no-unused-vars
async function update() {
    // 5 minutes
    setTimeout(update, 300000);

    var req = await fetch("./zplwii/api/groups");

    if (!req.ok)
        return; // TODO: Handle error

    var json = await req.json();

    var div = document.querySelector("div.scroll");
    while (div.children.length > 0)
        div.removeChild(div.lastChild);

    var playerCount = 0;
    var roomCount = 0;
    for (var room of json) {
        var [roomInfo, playerInfo, roomPlayerCount] = makeRoom(room);
        div.append(roomInfo);
        div.append(playerInfo);
        var hrDiv = document.createElement("div");
        hrDiv.append(document.createElement("hr"));
        div.append(hrDiv);
        playerCount += roomPlayerCount;
        roomCount++;
    }

    document.getElementById("player-count").innerHTML = `${playerCount} Players Online Across ${roomCount} Rooms`;
}
