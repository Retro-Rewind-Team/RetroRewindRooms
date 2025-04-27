const express = require("express");

var app = express();
app.use(express.json());

app.use(express.urlencoded({ extended: true }));
app.use("/", express.static(__dirname + "/front"));

app.get("/", function(_, res) {
    res.sendFile(path.join(__dirname, "/index.html"));
});

app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

// Hold cached responses from rwfc.net/api/groups
const groupResponses = [];

// Holds the b64 img data
const responseByFc = {};

const base64toBlob = function(data) {
    const bytes = atob(data);
    let length = bytes.length;
    let out = new Uint8Array(length);

    while (length--) {
        out[length] = bytes.charCodeAt(length);
    }

    return new Blob([out]);
};

async function fetchImgAsBase64(url) {
    try {
        const response = await fetch(url);

        if (!response.ok)
            return null;

        return btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer())));
    }
    catch {
        return null;
    }
}

async function getMii(miiSpec) {
    const fc = miiSpec[0];
    const data = miiSpec[1];

    const formData = new FormData;
    formData.append("data", base64toBlob(data), "mii.dat");
    formData.append("platform", "wii");

    try {
        // fc is used to cache responses on the server
        const response = await fetch("https://miicontestp.wii.rc24.xyz/cgi-bin/studio.cgi", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            console.error("Bad response from qrcode.rc24.xyz, status code: " + response.status);
            return [fc, null];
        }

        const json = await response.json();

        if (!json || !json.mii) {
            console.error("Malformed JSON response from qrcode.rc24.xyz");
            return [fc, null];
        }

        const miiImageUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${json.mii}&type=face&expression=normal&width=270&bgColor=FFFFFF00&clothesColor=default&cameraXRotate=0&cameraYRotate=0&cameraZRotate=0&characterXRotate=0&characterYRotate=0&characterZRotate=0&lightDirectionMode=none&instanceCount=1&instanceRotationMode=model`;

        const b64 = await fetchImgAsBase64(miiImageUrl);

        responseByFc[fc] = b64;

        return [fc, b64];
    }
    catch (e) {
        console.log("Unable to get mii, error: " + e);
        return [fc, null];
    }
}

app.post("/qrcoderc24", async function(req, res) {
    if (!req.body || typeof (req.body) != "object") {
        res.sendStatus(400);
        return;
    }

    const resBody = {};
    const reqsToMake = [];

    for (const fc in req.body) {
        if (!req.body.hasOwnProperty(fc))
            continue;

        const cached = responseByFc[fc];

        if (cached) {
            resBody[fc] = cached;
            continue;
        }

        reqsToMake.push([fc, req.body[fc]]);
    }

    function procMiiResponse(miiRes) {
        resBody[miiRes[0]] = miiRes[1];
    }

    if (reqsToMake.length != 0) {
        const tasks = reqsToMake.map(getMii);
        const resp = await Promise.all(tasks);
        resp.forEach(procMiiResponse);
    }

    res.send(JSON.stringify(resBody));
});

app.get("/groups", function(req, res) {
    var id = groupResponses[groupResponses.length - 1].id;

    if (req.query.id) {
        id = parseInt(req.query.id, 10);

        if (req.query.id == "min")
            id = groupResponses[0].id;
        else if (id == NaN) {
            res.sendStatus(400);
            return;
        }
    }

    const idx = id - groupResponses[0].id;

    if (idx < 0 || idx > 60) {
        res.status(400);
        res.send(`Response does not exist for id ${id}, is your id too far back?`);
        return;
    }

    const response = groupResponses[idx];
    if (!response) {
        res.status(404);
        res.send(`Response does not exist for id ${id}, but it should. Is rwfc.net down or is it just not populated yet?`);
        return;
    }

    // calculate average vr for each room
    for (const room of response.rooms) {
        // if room has no players, or players object doesnt exist then set vr to null
        if (!room.players || room.players.length === 0) {
            room.averageVR = null;
            continue;
        }
        const players = Object.values(room.players);

        // Only players who actually have a valid vr
        const playersWithVR = players.filter(player => player.ev !== undefined);

        const totalVR = playersWithVR.reduce((sum, player) => sum + Number(player.ev || 0), 0);
        const averageVR = playersWithVR.length > 0 ? totalVR / playersWithVR.length : 0;

        room.averageVR = Math.round(averageVR);
    }

    // Minimum allowed id at a given time
    response.minimum_id = groupResponses[0].id;

    res.set({
        ["Cache-Control"]: "no-cache, no-store, must-revalidate",
        ["Expires"]: 0,
    });
    res.send(JSON.stringify(response));
});

function getDataForFC(fc) {
    for (let i = groupResponses.length - 1; i > -1; i--) {
        const group = groupResponses[i];

        for (const ridx in group.rooms) {
            const room = group.rooms[ridx];

            for (const pidx in room.players) {
                const player = room.players[pidx];

                if (player.fc == fc && player.mii && player.mii[0])
                    return player.mii[0].data;
            }
        }
    }

    return null;
}

app.get("/miiimg", async function(req, res) {
    let imgb64;

    if (!req.query.fc) {
        res.status(404);
        res.send("The queried FC was not found or does not have an associated Mii");
        return;
    }

    if (!(imgb64 = responseByFc[req.query.fc])) {
        let miiData;

        if ((miiData = getDataForFC(req.query.fc)))
            [_, imgb64] = await getMii([req.query.fc, miiData]);
        else {
            res.status(404);
            res.send("The queried FC was not found or does not have an associated Mii");
            return;
        }
    }

    let img = Buffer.from(imgb64, "base64");
    res.status(200);
    res.set("Content-Type", "image/png");
    res.set("Content-Length", img.length);
    res.send(img);
});

var id = 0;
function updateCachedGroups(response) {
    const len = groupResponses.push({ timestamp: Date.now(), rooms: response, id: id });
    console.log(`Updated groups (${response != null ? "successfully" : "unsuccessfully"}): Time is ${new Date(Date.now())}, id is ${id}`);

    id++;

    if (len > 60)
        groupResponses.shift();
}

async function updateGroups() {
    try {
        const response = await fetch("http://rwfc.net/api/groups");

        var json = null;

        if (!response.ok)
            console.error("Failed to retrieve groups!");
        else
            json = await response.json();

        updateCachedGroups(json);
    }
    catch (e) {
        console.error(e);
        updateCachedGroups(null);
    }
}

// Once a minute
setInterval(updateGroups, 60000);
// Initial call
updateGroups();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
