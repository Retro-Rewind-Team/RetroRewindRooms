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

const base64toBlob = function(data) {
    const bytes = atob(data);
    let length = bytes.length;
    let out = new Uint8Array(length);

    while (length--) {
        out[length] = bytes.charCodeAt(length);
    }

    return new Blob([out]);
};

var miisInProgress = [];

async function getMii(miiTd) {
    if (miisInProgress.includes(miiTd))
        return null;

    miisInProgress.push(miiTd);

    var formData = new FormData;
    formData.append("data", base64toBlob(miiTd.dataset.miiData), "mii.dat");
    formData.append("platform", "wii");

    var response = await fetch("./qrcoderc24/cgi-bin/studio.cgi", {
        method: "POST",
        body: formData,
    });

    if (!response.ok)
        return null;

    var json = await response.json();

    if (!json || !json.mii)
        return null;

    var miiImageUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${json.mii}&type=face&expression=normal&width=270&bgColor=FFFFFF00&clothesColor=default&cameraXRotate=0&cameraYRotate=0&cameraZRotate=0&characterXRotate=0&characterYRotate=0&characterZRotate=0&lightDirectionMode=none&instanceCount=1&instanceRotationMode=model`;

    var img = document.createElement("img");
    img.src = miiImageUrl;
    img.classList.add("mii");

    return [miiTd, img];
}

function makePlayer(player) {
    var tr = document.createElement("tr");
    tr.classList.add("player-row");
    if (player.mii && player.mii[0]) {
        var miiTd = document.createElement("td");
        miiTd.classList.add("mii");
        miiTd.dataset.miiData = player.mii[0].data;
        tr.append(miiTd);
        tr.append(makeTd(player.mii[0].name));
    }
    else {
        tr.append(makeTd(""));
        tr.append(makeTd(player.name));
    }
    tr.append(makeTd(player.fc));
    tr.append(makeTd(player.ev ? player.ev : ""));

    return tr;
}

function makePlayerInfo(players) {
    var playerCount = 0;
    var ret = document.createElement("tr");
    ret.classList.add("closed");
    ret.classList.add("player-info");
    var ghostTd = document.createElement("td");
    ghostTd.classList.add("ghost");
    ret.append(ghostTd);
    var td = document.createElement("td");
    td.colSpan = 5;

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

    td.append(table);
    ret.append(td);

    for (var id in players) {
        tBody.append(makePlayer(players[id]));
        playerCount++;
    }

    return [ret, playerCount];
}

function makeRoom(room) {
    function pad(num, size) {
        num = num.toString();
        while (num.length < size)
            num = "0" + num;

        return num;
    }

    var roomInfo = document.createElement("tr");

    var [playerInfo, playerCount] = makePlayerInfo(room.players);

    roomInfo.classList.add("collapsible");
    var arrowTd = document.createElement("td");
    arrowTd.classList.add("arrow");
    roomInfo.append(arrowTd);
    var roomType;

    if (!room.rk)
        roomType = "??";
    else
        roomType = room.rk == "vs_10" ? "VS" : "TT";

    roomInfo.append(makeTd(playerCount));
    roomInfo.append(makeTd(roomType));
    // room.type is actually the access: public or private
    roomInfo.append(makeTd(room.type));

    var timeDiff = Date.now() - new Date(room.created).getTime();
    var hours = Math.floor(timeDiff / (1000 * 60 * 60));
    timeDiff -= hours * (1000 * 60 * 60);

    var mins = Math.floor(timeDiff / (1000 * 60));
    timeDiff -= mins * (1000 * 60);

    var seconds = Math.floor(timeDiff / (1000));
    timeDiff -= seconds * (1000);

    roomInfo.append(makeTd(`${pad(hours, 2)}:${pad(mins, 2)}:${pad(seconds, 2)}`));
    roomInfo.append(makeTd(room.id));

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

    var tableBody = document.querySelector("tbody");
    while (tableBody.children.length > 0)
        tableBody.removeChild(tableBody.lastChild);

    var playerCount = 0;
    for (var room of json) {
        var [roomInfo, playerInfo, roomPlayerCount] = makeRoom(room);
        tableBody.append(roomInfo);
        tableBody.append(playerInfo);
        playerCount += roomPlayerCount;
    }

    document.querySelector("h3").innerHTML = `${playerCount} Players Online`;

    var collapsibles = document.getElementsByClassName("collapsible");
    for (var e of collapsibles) {
        e.onclick = async function() {
            var closing = this.classList.contains("active");
            this.classList.toggle("active");

            this.firstChild.classList.toggle("down");

            var contents = this.nextSibling;
            contents.classList.toggle("closed");
            contents.classList.toggle("open");

            if (closing)
                return;

            var procMiiResponse = function(miiSpec) {
                var miiTd = miiSpec[0];
                var miiImg = miiSpec[1];
                if (miiTd.children.length != 0 || !miiImg)
                    return;

                miiTd.append(miiImg);
            };

            var getMiiTds = [];
            for (var miiTd of contents.querySelectorAll(".mii")) {
                if (miiTd.children.length != 0)
                    continue;

                getMiiTds.push(miiTd);
            };

            var tasks = getMiiTds.map(getMii);
            var results = await Promise.all(tasks);
            results.forEach(procMiiResponse);
        };
    }
}
