const express = require("express");
const multer = require("multer");
const { fromBuffer } = require("pdf2pic");
const Tesseract = require("tesseract.js");
const cors = require("cors");

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

app.use(cors());
app.use(express.json());

app.post("/process-pdf", upload.single("pdf"), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No PDF file provided" });
    }

    if (req.file.mimetype !== "application/pdf") {
      return res.status(400).json({ error: "Invalid file type. Only PDF files are supported" });
    }

    const buffer = req.file.buffer;
    if (buffer.length < 100) {
      return res.status(400).json({ error: "PDF file is too small or empty" });
    }

    let output;
    try {
      output = await fromBuffer(buffer, {
        density: 300,
        format: "png",
        width: 1654,
        height: 2339,
      }).bulk(-1);
    } catch (pdfError) {
      console.error("pdf2pic Error:", pdfError);
      return res.status(500).json({ error: `Failed to convert PDF to images: ${pdfError.message}` });
    }

    if (!output || output.length === 0) {
      return res.status(400).json({ error: "No pages extracted from PDF" });
    }

    let allText = "";
    for (const page of output) {
      if (!page.buffer) {
        console.warn("Empty page buffer detected, skipping");
        continue;
      }
      try {
        const result = await Tesseract.recognize(page.buffer, "eng", {
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
        });
        const text = result.data.text.trim();
        if (text) {
          allText += text + " ";
        }
      } catch (tessError) {
        console.error("Tesseract Error on page:", tessError);
      }
    }

    if (!allText.trim()) {
      return res.status(400).json({ error: "No text extracted from PDF. Ensure the PDF is a filled CMS-1500 form." });
    }

    res.json({ text: allText.trim() });
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to process PDF" });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});