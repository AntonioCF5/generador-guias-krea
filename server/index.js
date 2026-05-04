const path = require("path");
const express = require("express");
const https = require("https");

const app = express();
const PORT = 9000;
const appDir = path.join(__dirname, "..", "app");

app.get("/", (req, res) => {
  res.sendFile(path.join(appDir, "widget.html"));
});
app.use(express.static(appDir));

let serverOptions;
try {
  const selfsigned = require("selfsigned");
  const pems = selfsigned.generate(
    [{ name: "commonName", value: "127.0.0.1" }],
    { days: 365 }
  );
  serverOptions = { key: pems.private, cert: pems.cert };
} catch {
  const { execSync } = require("child_process");
  const fs = require("fs");
  const tmpKey = path.join(__dirname, "tmp-key.pem");
  const tmpCert = path.join(__dirname, "tmp-cert.pem");
  execSync(
    `openssl req -x509 -newkey rsa:2048 -keyout ${tmpKey} -out ${tmpCert} -days 365 -nodes -subj "/CN=127.0.0.1"`
  );
  serverOptions = {
    key: fs.readFileSync(tmpKey),
    cert: fs.readFileSync(tmpCert),
  };
  fs.unlinkSync(tmpKey);
  fs.unlinkSync(tmpCert);
}

https.createServer(serverOptions, app).listen(PORT, "127.0.0.1", () => {
  console.log(`Widget server running at https://127.0.0.1:${PORT}`);
});
