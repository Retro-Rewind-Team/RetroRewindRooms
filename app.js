var express = require("express");
var proxy = require("express-http-proxy");

const app = express();
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

// Holds the b64 img data
var responseByFc = {};

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
        var response = await fetch(url);

        if (!response.ok)
            return null;

        return btoa(String.fromCharCode(...new Uint8Array(await response.arrayBuffer())));
    }
    catch {
        return null;
    }
}

async function getMii(miiSpec) {
    var fc = miiSpec[0];
    var data = miiSpec[1];

    var formData = new FormData;
    formData.append("data", base64toBlob(data), "mii.dat");
    formData.append("platform", "wii");

    try {
        // fc is used to cache responses on the server
        var response = await fetch("https://qrcode.rc24.xyz/cgi-bin/studio.cgi", {
            method: "POST",
            body: formData,
        });

        if (!response.ok)
            return [fc, null];

        var json = await response.json();

        if (!json || !json.mii)
            return [fc, null];

        var miiImageUrl = `https://studio.mii.nintendo.com/miis/image.png?data=${json.mii}&type=face&expression=normal&width=270&bgColor=FFFFFF00&clothesColor=default&cameraXRotate=0&cameraYRotate=0&cameraZRotate=0&characterXRotate=0&characterYRotate=0&characterZRotate=0&lightDirectionMode=none&instanceCount=1&instanceRotationMode=model`;

        var b64 = await fetchImgAsBase64(miiImageUrl);

        responseByFc[fc] = b64;

        return [fc, b64];
    }
    catch {
        return [fc, null];
    }
}

app.post("/qrcoderc24", async function(req, res) {
    if (!req.body || typeof (req.body) != "object") {
        res.sendStatus(400);
        return;
    }

    var resBody = {};
    var reqsToMake = [];

    for (var fc in req.body) {
        if (!req.body.hasOwnProperty(fc))
            continue;

        var cached = responseByFc[fc];

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
        var tasks = reqsToMake.map(getMii);
        var resp = await Promise.all(tasks);
        resp.forEach(procMiiResponse);
    }

    res.send(JSON.stringify(resBody));
});

app.use("/zplwii", proxy("zplwii.xyz", { parseReqBody: false }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
