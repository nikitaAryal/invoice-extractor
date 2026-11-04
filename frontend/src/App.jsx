import React, { useState } from 'react';

export default function InvoiceExtractorApp() {
  const [imageFile, setImageFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [validation, setValidation] = useState(null);

  const processInvoice = async (file) => {
    setLoading(true);
    setError(null);
    setExtractedData(null);
    setValidation(null);

    try {
      // Prepare the image for the backend
      const formData = new FormData();
      formData.append('invoice', file);

      // Send the image to our Node.js backend
      const response = await fetch(
        'http://127.0.0.1:5001/api/invoices/extract',
        {
          method: 'POST',
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to extract invoice information.'
        );
      }

      // Store the extracted invoice and validation results
      setExtractedData(result.invoice);
      setValidation(result.validation);

    } catch (err) {
      console.error('Invoice processing error:', err);
      setError(
        err.message || 'Failed to process the invoice. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, etc.).');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10 MB.');
      return;
    }

    setImageFile(file);
    setPreviewUrl(URL.createObjectURL(file));
    processInvoice(file);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }

    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(value);
  };

  return (
    <div style={{ fontFamily: 'sans-serif', padding: '20px' }}>
      <h1>Invoice Extractor</h1>

      <div style={{ marginBottom: '20px' }}>
        <p>Upload an Invoice Image:</p>

        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          disabled={loading}
        />
      </div>

      {previewUrl && (
        <div style={{ marginBottom: '20px' }}>
          <img
            src={previewUrl}
            alt="Invoice preview"
            style={{
              maxWidth: '300px',
              border: '1px solid #ccc',
            }}
          />
        </div>
      )}

      {loading && <p>Processing... Please wait.</p>}

      {error && (
        <p style={{ color: 'red' }}>{error}</p>
      )}

      {extractedData && !loading && (
        <div>
          <h2>Extracted Invoice Details</h2>

          <p>
            <strong>Invoice Number:</strong>{' '}
            {extractedData.invoiceNumber || 'N/A'}
          </p>

          <p>
            <strong>Invoice Date:</strong>{' '}
            {extractedData.invoiceDate || 'N/A'}
          </p>

          <p>
            <strong>Supplier Name:</strong>{' '}
            {extractedData.supplierName || 'N/A'}
          </p>

          {validation && (
            <div>
              <h3>Validation Results</h3>

              <p>
                <strong>Status:</strong>{' '}
                {validation.isValid ? 'Valid' : 'Incomplete'}
              </p>

              {validation.missingFields?.length > 0 && (
                <p>
                  <strong>Missing fields:</strong>{' '}
                  {validation.missingFields.join(', ')}
                </p>
              )}

              {validation.warnings?.length > 0 && (
                <ul>
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <h3>Line Items</h3>

          <table
            border="1"
            cellPadding="8"
            style={{
              borderCollapse: 'collapse',
              marginBottom: '20px',
              width: '100%',
              maxWidth: '800px',
            }}
          >
            <thead>
              <tr style={{
                backgroundColor: '#f2f2f2',
                textAlign: 'left',
              }}>
                <th>Item Number</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {extractedData.items?.length > 0 ? (
                extractedData.items.map((item, index) => (
                  <tr key={index}>
                    <td>{item.itemNumber ?? '-'}</td>
                    <td>{item.description ?? '-'}</td>
                    <td>{item.quantity ?? '-'}</td>
                    <td>{formatCurrency(item.unitPrice)}</td>
                    <td>{formatCurrency(item.totalAmount)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5">No items found.</td>
                </tr>
              )}
            </tbody>
          </table>

          <p>
            <strong>Total Amount:</strong>{' '}
            {formatCurrency(extractedData.totalAmount)}
          </p>
        </div>
      )}
    </div>
  );
}
