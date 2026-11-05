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
const nullableString = z.string().nullable();
const nullableNumber = z.number().nullable();

const invoiceSchema = z.object({
  invoiceNumber: nullableString,
  invoiceDate: nullableString,
  dueDate: nullableString,
  paymentTerms: nullableString,

  supplierName: nullableString,

  supplier: z.object({
    name: nullableString,
    address: nullableString,
    phone: nullableString,
    email: nullableString,
  }),

  buyer: z.object({
    name: nullableString,
    department: nullableString,
    address: nullableString,
  }),

  currency: nullableString,

  items: z.array(
    z.object({
      itemNumber: nullableString,
      description: nullableString,
      quantity: nullableNumber,
      unit: nullableString,
      unitPrice: nullableNumber,
      totalAmount: nullableNumber,
    })
  ),

  subtotal: nullableNumber,

  tax: z.object({
    type: nullableString,
    rate: nullableNumber,
    amount: nullableNumber,
  }),

  discount: nullableNumber,
  shipping: nullableNumber,
  totalAmount: nullableNumber,
});

// Test route
app.get("/", (req, res) => {
  res.json({
    message: "Invoice Extractor Backend is running!",
  });
});

// Check numerical consistency in the extracted invoice
function validateInvoiceNumbers(invoice) {
  const warnings = [];
  const TOLERANCE = 0.02;

  let calculatedItemsTotal = 0;

  const allItemTotalsAvailable =
    invoice.items.length > 0 &&
    invoice.items.every(item => item.totalAmount !== null);

  // Check individual line items
  invoice.items.forEach((item, index) => {
    if (
      item.quantity !== null &&
      item.unitPrice !== null &&
      item.totalAmount !== null
    ) {
      const expectedTotal =
        item.quantity * item.unitPrice;

      if (
        Math.abs(expectedTotal - item.totalAmount) >
        TOLERANCE
      ) {
        warnings.push(
          `Item ${item.itemNumber || index + 1}: Quantity × unit price does not match item total.`
        );
      }
    }

    if (item.totalAmount !== null) {
      calculatedItemsTotal += item.totalAmount;
    }
  });

  // Check subtotal against line-item totals
  if (
    invoice.subtotal !== null &&
    allItemTotalsAvailable
  ) {
    if (
      Math.abs(calculatedItemsTotal - invoice.subtotal) >
      TOLERANCE
    ) {
      warnings.push(
        "The sum of line items does not match the invoice subtotal."
      );
    }
  }

  // Check tax calculation when both rate and base are available
  if (
    invoice.subtotal !== null &&
    invoice.tax.rate !== null &&
    invoice.tax.amount !== null
  ) {
    const expectedTax =
      invoice.subtotal * invoice.tax.rate / 100;

    if (
      Math.abs(expectedTax - invoice.tax.amount) >
      TOLERANCE
    ) {
      warnings.push(
        "The extracted tax amount does not match the tax percentage."
      );
    }
  }

  // Check final invoice total
  if (
    invoice.subtotal !== null &&
    invoice.tax.amount !== null &&
    invoice.totalAmount !== null
  ) {
    const expectedGrandTotal =
      invoice.subtotal +
      invoice.tax.amount -
      (invoice.discount ?? 0) +
      (invoice.shipping ?? 0);

    if (
      Math.abs(expectedGrandTotal - invoice.totalAmount) >
      TOLERANCE
    ) {
      warnings.push(
        "The subtotal, tax, discount and shipping do not reconcile with the invoice total."
      );
    }
  }

  return warnings;
}

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
You are an expert invoice data extraction system.

Analyze the provided invoice image and extract all available
information into structured JSON.

Extract the following fields:

1. Invoice information:
- invoiceNumber
- invoiceDate
- dueDate
- paymentTerms
- currency

2. Supplier information:
- supplierName
- supplier.name
- supplier.address
- supplier.phone
- supplier.email

3. Buyer information:
- buyer.name
- buyer.department
- buyer.address

4. Line items:
- itemNumber
- description
- quantity
- unit
- unitPrice
- totalAmount

5. Financial information:
- subtotal
- tax.type
- tax.rate
- tax.amount
- discount
- shipping
- totalAmount

IMPORTANT EXTRACTION RULES:

- Extract only information visible in the invoice.
- Never invent or assume missing information.
- Use null for missing or unreadable values.
- Use numbers for all monetary amounts and quantities.
- Do not include currency symbols inside numerical values.
- Preserve the currency separately in the currency field.
- Normalize dates to YYYY-MM-DD when unambiguous.
- Preserve the original meaning of item descriptions.
- Extract units such as pcs, kg, hours, or lot when available.
- Include delivery charges in line items if they appear as line items.
- Only extract shipping separately if it is shown separately
  outside the line-item subtotal.
- Do not count the same charge twice.
- Extract VAT/GST percentage and amount separately.
- Extract subtotal before tax where available.
- Do not calculate missing values or invent tax rates.
- Do not assume that an invoice is invalid just because
  some information is missing.

Return ONLY valid JSON matching the required schema.
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
    dueDate: { type: ["string", "null"] },
    paymentTerms: { type: ["string", "null"] },

    supplierName: { type: ["string", "null"] },

    supplier: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        address: { type: ["string", "null"] },
        phone: { type: ["string", "null"] },
        email: { type: ["string", "null"] }
      },
      required: ["name", "address", "phone", "email"]
    },

    buyer: {
      type: "object",
      properties: {
        name: { type: ["string", "null"] },
        department: { type: ["string", "null"] },
        address: { type: ["string", "null"] }
      },
      required: ["name", "department", "address"]
    },

    currency: { type: ["string", "null"] },

    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          itemNumber: { type: ["string", "null"] },
          description: { type: ["string", "null"] },
          quantity: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          unitPrice: { type: ["number", "null"] },
          totalAmount: { type: ["number", "null"] }
        },
        required: [
          "itemNumber",
          "description",
          "quantity",
          "unit",
          "unitPrice",
          "totalAmount"
        ]
      }
    },

    subtotal: { type: ["number", "null"] },

    tax: {
      type: "object",
      properties: {
        type: { type: ["string", "null"] },
        rate: { type: ["number", "null"] },
        amount: { type: ["number", "null"] }
      },
      required: ["type", "rate", "amount"]
    },

    discount: { type: ["number", "null"] },
    shipping: { type: ["number", "null"] },
    totalAmount: { type: ["number", "null"] }
  },

  required: [
    "invoiceNumber",
    "invoiceDate",
    "dueDate",
    "paymentTerms",
    "supplierName",
    "supplier",
    "buyer",
    "currency",
    "items",
    "subtotal",
    "tax",
    "discount",
    "shipping",
    "totalAmount"
  ]
},
      },
    });

let extractedData;

try {
  extractedData = JSON.parse(response.text);
} catch (error) {
  console.error("Invalid JSON returned by Gemini:", error);

  return res.status(502).json({
    success: false,
    message: "The AI returned an unreadable response. Please try again.",
  });
}
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

if (!invoice.invoiceNumber) {
  missingFields.push("invoiceNumber");
}

if (!invoice.invoiceDate) {
  missingFields.push("invoiceDate");
}

if (!invoice.supplierName) {
  missingFields.push("supplierName");
}

if (!invoice.currency) {
  missingFields.push("currency");
}

if (invoice.subtotal === null) {
  missingFields.push("subtotal");
}

if (invoice.totalAmount === null) {
  missingFields.push("totalAmount");
}

const warnings = validateInvoiceNumbers(invoice);

return res.json({
  success: true,
  invoice,
  validation: {
    isValid: missingFields.length === 0,
    missingFields,
    warnings,
  },
});

    } catch (error) {
    console.error("Invoice extraction error:", error);

    return res.status(502).json({
      success: false,
      message: "Invoice processing failed. Please try again.",
    });
  }
});

// Handle upload errors
app.use((err, req, res, next) => {
  console.error("Upload error:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "The image is too large. Maximum file size is 10 MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: "There was a problem uploading the image.",
    });
  }

  return res.status(400).json({
    success: false,
    message: err.message || "Invalid image upload.",
  });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
