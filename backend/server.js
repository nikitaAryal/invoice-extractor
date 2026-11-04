import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// Store uploaded images in memory temporarily
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, callback) => {
    if (!file.mimetype.startsWith("image/")) {
      return callback(new Error("Only image files are allowed."));
    }
    callback(null, true);
  },
});

// Validate the invoice data returned by Gemini
const invoiceSchema = z.object({
  invoiceNumber: z.string().nullable(),
  invoiceDate: z.string().nullable(),
  supplierName: z.string().nullable(),
  items: z.array(
    z.object({
      itemNumber: z.string().nullable(),
      description: z.string().nullable(),
      quantity: z.number().nullable(),
      unitPrice: z.number().nullable(),
      totalAmount: z.number().nullable(),
    })
  ),
  totalAmount: z.number().nullable(),
});

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Invoice Extractor Backend is running!",
  });
});

// Invoice extraction route
app.post("/api/invoices/extract", upload.single("invoice"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an invoice image.",
      });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({
        success: false,
        message: "Gemini API key is not configured.",
      });
    }

    const ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
    });

    const imageBase64 = req.file.buffer.toString("base64");

    const prompt = `
      Extract the invoice information from this image.

      Return ONLY valid JSON with these fields:
      invoiceNumber, invoiceDate, supplierName, items, totalAmount.

      Each item must contain:
      itemNumber, description, quantity, unitPrice, totalAmount.

      Rules:
      - Use null when information is missing or unreadable.
      - Do not guess or invent missing information.
      - Quantity, unitPrice and totalAmount must be numbers or null.
      - Preserve the original currency values as numbers.
      - Do not calculate values that are not present on the invoice.
      - Return an empty array if no line items are identifiable.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          inlineData: {
            mimeType: req.file.mimetype,
            data: imageBase64,
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: "application/json",
        responseJsonSchema: {
          type: "object",
          properties: {
            invoiceNumber: { type: ["string", "null"] },
            invoiceDate: { type: ["string", "null"] },
            supplierName: { type: ["string", "null"] },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  itemNumber: { type: ["string", "null"] },
                  description: { type: ["string", "null"] },
                  quantity: { type: ["number", "null"] },
                  unitPrice: { type: ["number", "null"] },
                  totalAmount: { type: ["number", "null"] },
                },
                required: [
                  "itemNumber",
                  "description",
                  "quantity",
                  "unitPrice",
                  "totalAmount",
                ],
              },
            },
            totalAmount: { type: ["number", "null"] },
          },
          required: [
            "invoiceNumber",
            "invoiceDate",
            "supplierName",
            "items",
            "totalAmount",
          ],
        },
      },
    });

    const extractedData = JSON.parse(response.text);

    const validation = invoiceSchema.safeParse(extractedData);

    if (!validation.success) {
      return res.status(422).json({
        success: false,
        message: "Gemini returned data that failed validation.",
        errors: validation.error.issues,
      });
    }

    const invoice = validation.data;

    const missingFields = [];

    if (!invoice.invoiceNumber) missingFields.push("invoiceNumber");
    if (!invoice.invoiceDate) missingFields.push("invoiceDate");
    if (!invoice.supplierName) missingFields.push("supplierName");
    if (invoice.totalAmount === null) missingFields.push("totalAmount");

    res.json({
      success: true,
      invoice,
      validation: {
        isValid: missingFields.length === 0,
        missingFields,
        warnings: [],
      },
    });

  } catch (error) {
    console.error("Invoice extraction error:", error);

    res.status(500).json({
      success: false,
      message: "Unable to process the invoice.",
      error: error.message,
    });
  }
});

// Handle upload errors
app.use((err, req, res, next) => {
  res.status(400).json({
    success: false,
    message: err.message || "Something went wrong.",
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
