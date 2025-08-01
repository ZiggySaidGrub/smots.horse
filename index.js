const fs = require("mz/fs");
const path = require("path");
const http = require("http");
const url = require("url");
const { Readable } = require("stream");
const colors = require("colors/safe");

// Setup frames in memory
// Load frames into memory once
let original = [];
let flipped = [];

(async () => {
  const framesPath = "frames";
  const files = await fs.readdir(framesPath);

  original = await Promise.all(
    files.map(async (file) => {
      const frame = await fs.readFile(path.join(framesPath, file));
      return frame.toString();
    })
  );
  flipped = original.map((f) => {
    return f.toString().split("").reverse().join("");
  });
})().catch((err) => {
  console.log("Error loading frames");
  console.log(err);
});

const colorsOptions = [
  "white",
  "white",
  "white",
  "white",
  "white",
  "white",
  "white",
];
const numColors = colorsOptions.length;
const selectColor = (previousColor) => {
  let color;

  do {
    color = Math.floor(Math.random() * numColors);
  } while (color === previousColor);

  return color;
};

function streamer(stream, opts) {
  const frames = opts.flip ? flipped : original;
  let index = 0;
  let lastColor;
  let timer;

  function tick() {
    // clear screen
    stream.push("\u001b[38A");

    // color frame
    const coloredFrame = frames[index];

    // try to push; respect backpressure
    const ok = stream.push(coloredFrame);
    index = (index + 1) % frames.length;

    //setTimeout(tick, 33);
    if (ok) {
      timer = setTimeout(tick, 20);
    } else {
      /*stream.once('drain', () => {
        timer = setTimeout(tick, 17);
      });*/
      timer = setTimeout(tick, 20);
    }
  }

  // start
  stream.push("\u001b[2J\u001b[3J\u001b[H");
  tick();

  // cleanup function
  return () => {
    clearTimeout(timer);
  };
}

const validateQuery = ({ flip }) => ({
  flip: String(flip).toLowerCase() === "true",
});

const server = http.createServer((req, res) => {
  if (req.url === "/thesilly"){
    if (req.method === "POST"){
      if (!fs.exists("silly.json")){
        fs.writeFileSync("silly.json", JSON.stringify({counter:0}))
      }
      counter = JSON.parse(fs.readFileSync("silly.json"));
      counter.counter++;
      fs.writeFileSync(JSON.stringify(counter))
      return res.end(JSON.stringify({
        status: "ok",
        counter:JSON.parse(fs.readFileSync("silly.json")).counter
      }))
    } else if (req.method === "GET"){
      if (!fs.exists("silly.json")){
        return res.end(JSON.stringify({
          status: "ok",
          counter:0
        }))
      }
      return res.end(JSON.stringify({
        status: "ok",
        counter:JSON.parse(fs.readFileSync("silly.json")).counter
      }))
    } else return res.end(JSON.stringify({ status: ":despair:" }));
  }

  // Healthcheck route
  if (req.url === "/healthcheck") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ status: "ok" }));
  }

  if (
    req.headers &&
    req.headers["user-agent"] &&
    !req.headers["user-agent"].includes("curl")
  ) {
    if (getRandomInt(2) == 1) res.writeHead(302, { Location: "https://www.youtube.com/@smotsgaming" });
    else res.writeHead(302, { Location: "https://twitch.tv/nova_exists" });
    return res.end();
  }

  const stream = new Readable({ read() {} });
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  stream.pipe(res);

  // Start streaming with cleanup handler
  const opts = validateQuery(url.parse(req.url, true).query);
  const cleanupLoop = streamer(stream, opts);

  // Clean up when the client disconnects
  const onClose = () => {
    stream.push("\u001b[49m");
    cleanupLoop();
    stream.destroy();
  };
  res.on("close", onClose);
  res.on("error", onClose);
});

const port = process.env.PORT || 3000;
server.listen(port, (err) => {
  if (err) throw err;
  console.log(`Listening on http://localhost:${port}`);
});

function getRandomInt(max) {
  return Math.floor(Math.random() * max);
}