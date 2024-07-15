var express = require("express");
var proxy = require("express-http-proxy");

const app = express();

app.use(express.urlencoded({ extended: true }));
app.use("/", express.static(__dirname + "/front"));

app.get("/", function(_, res) {
    res.sendFile(path.join(__dirname, "/index.html"));
});

app.use((_, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
});

app.use("/qrcoderc24", proxy("qrcode.rc24.xyz", { parseReqBody: false }));
app.use("/zplwii", proxy("zplwii.xyz", { parseReqBody: false }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`listening on ${PORT}`));
