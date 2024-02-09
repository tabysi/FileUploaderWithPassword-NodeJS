require("dotenv").config();
const express = require("express");
const multer = require("multer");
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const File = require("./models/File");
const path = require("path");

const app = express();

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(helmet()); // Adds security headers

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use(limiter);

// Multer configuration for file upload
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + "-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// MongoDB connection
mongoose.connect(process.env.DATABASE_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});
const db = mongoose.connection;
db.on("error", console.error.bind(console, "MongoDB connection error:"));
db.once("open", () => console.log("Connected to MongoDB"));

// Set view engine
app.set("view engine", "ejs");

// Routes
// app.get("/", (req, res) => {
//   res.render("index");
// });

app.get("/", (req, res) => {
  res.render("index", { title: "Fileuploader for Trusted-Studios" });
});

app.post("/upload", upload.single("file"), async (req, res, next) => {
  try {
    console.log("Uploading file...");
  
    const fileData = {
      path: req.file.path,
      originalName: req.file.originalname,
      text: req.body.text || "",
    };

    if (req.body.password) {
      fileData.password = await bcrypt.hash(req.body.password, 10);
    }

    const file = await File.create(fileData);
    console.log("File created:", file);

    // res.render("index", { originalName: req.file.originalname, error: null });
    res.render("index", { fileLink: `/file/${file.id}` });
  } catch (error) {
    next(error); // Pass error to error handling middleware
  }
});

app.route("/file/:id").get(handleDownload).post(handleDownload);

async function handleDownload(req, res, next) {
  try {
    const file = await File.findById(req.params.id);

    console.log("Handling download for file:", file);

    if (!file) {
      console.log("File not found");
      return res.status(404).send("File not found");
    }

    if (file.password) {
      if (!req.body.password) {
        console.log("Password not provided");
        // Render the password entry page with the file name in the title
        return res.render("password", { title: `${file.text}` });
      }

      if (!(await bcrypt.compare(req.body.password, file.password))) {
        console.log("Incorrect password");
        return res.render("password", { title: `${file.text}`, error: true });
      }
    }

    file.downloadCount++;
    await file.save();
    console.log("Download count incremented:", file.downloadCount);

    res.download(file.path, file.originalName);
  } catch (error) {
    next(error); // Pass error to error handling middleware
  }
}


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send("Something went wrong!");
});

// Server listening
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
