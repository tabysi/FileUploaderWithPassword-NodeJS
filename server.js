require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const File = require("./models/File");

const app = express();
app.use(express.urlencoded({ extended: true }));

const upload = multer({ dest: "uploads" });

mongoose.connect(process.env.DATABASE_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('Error connecting to MongoDB:', err));

app.set("view engine", "ejs");

app.get("/", (req, res) => {
  res.render("index");
});

app.post("/upload", upload.single("file"), async (req, res) => {
  console.log("Uploading file...");
  
  const fileData = {
    path: req.file.path,
    originalName: req.file.originalname,
    text: req.body.text,
  };

  console.log("File data:", fileData);


  if (req.body.password != null && req.body.password !== "") {
    fileData.password = await bcrypt.hash(req.body.password, 10);
  }

  const file = await File.create(fileData);
  console.log("File created:", file);

  res.render("index", { fileLink: `${req.headers.origin}/file/${file.id}` });
});

app.route("/file/:id").get(handleDownload).post(handleDownload);

async function handleDownload(req, res) {
  const file = await File.findById(req.params.id);

  console.log("Handling download for file:", file);

  if (!file) {
    console.log("File not found");
    return res.status(404).send("File not found");
  }

  if (file.password != null) {
    if (!req.body.password) {
      console.log("Password not provided");
      return res.render("password");
    }

    if (!(await bcrypt.compare(req.body.password, file.password))) {
      console.log("Incorrect password");
      return res.render("password", { error: true });
    }
  }

  file.downloadCount++;
  await file.save();
  console.log("Download count incremented:", file.downloadCount);

  res.download(file.path, file.originalName);
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
