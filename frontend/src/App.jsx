
import React, { useState, useEffect } from 'react';
import './App.css';

export default function InvoiceExtractorApp() {
  const [previewUrl, setPreviewUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [extractedData, setExtractedData] = useState(null);
  const [validation, setValidation] = useState(null);
  const [showJson, setShowJson] = useState(false);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const processInvoice = async (file) => {
    setLoading(true);
    setError(null);
    setExtractedData(null);
    setValidation(null);
    setShowJson(false);

    try {
      const formData = new FormData();
      formData.append('invoice', file);

      const response = await fetch(
        'http://127.0.0.1:5001/api/invoices/extract',
        {
          method: 'POST',
          body: formData,
        }
      );

      let result;

      try {
        result = await response.json();
      } catch {
        throw new Error(
          'The server returned an unexpected response. Please try again.'
        );
      }

      if (!response.ok || !result.success) {
        throw new Error(
          result.message || 'Failed to extract invoice information.'
        );
      }

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

    setError(null);

    if (!file.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPEG, PNG, etc.).');
      e.target.value = '';
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Image size must be less than 10 MB.');
      e.target.value = '';
      return;
    }

    setPreviewUrl(URL.createObjectURL(file));
    processInvoice(file);
  };

  const formatCurrency = (value) => {
    if (value === null || value === undefined || value === '') {
      return '—';
    }

    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const downloadJson = () => {
    const jsonData = {
      ...extractedData,
      validation,
    };

    const jsonString = JSON.stringify(jsonData, null, 2);

    const blob = new Blob([jsonString], {
      type: 'application/json',
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${extractedData.invoiceNumber || 'invoice'}.json`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  };

  const resetInvoice = () => {
    setPreviewUrl(null);
    setExtractedData(null);
    setValidation(null);
    setError(null);
    setShowJson(false);

    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) fileInput.value = '';
  };

  return (
    <div className="app-container">

      {/* Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">
            <span>▤</span>
          </div>

          <div>
            <h1>Invoice Extractor</h1>
            <p>Smart invoice data extraction</p>
          </div>
        </div>

        <span className="header-tag">AI Powered</span>
      </header>

      <main className="main-content">

        {/* Introduction */}
        <section className="welcome-section">
          <div>
            <h2>Invoice Processing</h2>
            <p>
              Upload an invoice image and automatically extract
              its important information.
            </p>
          </div>
        </section>

        {/* Upload Section */}
        <section className="upload-card">
          <div className="section-heading">
            <div>
              <h3>Upload Invoice</h3>
              <p>Choose an invoice image to get started.</p>
            </div>
          </div>

          <label className="upload-area">
            <div className="upload-icon">↑</div>
            <h4>Choose an invoice image</h4>
            <p>Click below to browse your files</p>

            <span className="upload-button">
              Choose File
            </span>

            <span className="upload-hint">
              JPG, JPEG or PNG · Maximum 10 MB
            </span>

            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={loading}
            />
          </label>

          {previewUrl && (
            <div className="preview-section">
              <h4>Uploaded Invoice</h4>
              <img
                src={previewUrl}
                alt="Invoice preview"
                className="invoice-preview"
              />
            </div>
          )}

          {loading && (
            <div className="loading-message">
              <div className="spinner"></div>
              <div>
                <strong>Processing your invoice...</strong>
                <p>Please wait while AI extracts the information.</p>
              </div>
            </div>
          )}

          {error && (
            <div className="error-message">
              <strong>Something went wrong</strong>
              <p>{error}</p>
            </div>
          )}
        </section>

        {/* Extracted Information */}
        {extractedData && !loading && (
          <div className="results-container">

            <div className="results-heading">
              <div>
                <h2>Extracted Information</h2>
                <p>Review the information extracted from your invoice.</p>
              </div>

              <span
                className={`status-badge ${
                  validation?.isValid ? 'success' : 'warning'
                }`}
              >
                {validation?.isValid
                  ? '✓ Complete'
                  : '⚠ Needs Review'}
              </span>
            </div>

            {/* Invoice Details */}
            <section className="details-card">
              <h3>Invoice Details</h3>

              <div className="details-grid">
                <div className="detail-item">
                  <span>Invoice Number</span>
                  <strong>{extractedData.invoiceNumber || '—'}</strong>
                </div>

                <div className="detail-item">
                  <span>Invoice Date</span>
                  <strong>{extractedData.invoiceDate || '—'}</strong>
                </div>

                <div className="detail-item">
                  <span>Due Date</span>
                  <strong>{extractedData.dueDate || '—'}</strong>
                </div>

                <div className="detail-item">
                  <span>Payment Terms</span>
                  <strong>{extractedData.paymentTerms || '—'}</strong>
                </div>

                <div className="detail-item">
                  <span>Currency</span>
                  <strong>{extractedData.currency || '—'}</strong>
                </div>
              </div>
            </section>

            {/* Supplier and Buyer */}
            <div className="party-grid">

              <section className="details-card">
                <h3>Supplier Information</h3>

                <div className="party-details">
                  <strong>
                    {extractedData.supplier?.name ||
                      extractedData.supplierName || '—'}
                  </strong>

                  <span>
                    {extractedData.supplier?.address || '—'}
                  </span>

                  <span>
                    {extractedData.supplier?.phone || '—'}
                  </span>

                  <span>
                    {extractedData.supplier?.email || '—'}
                  </span>
                </div>
              </section>

              <section className="details-card">
                <h3>Buyer Information</h3>

                <div className="party-details">
                  <strong>
                    {extractedData.buyer?.name || '—'}
                  </strong>

                  <span>
                    {extractedData.buyer?.department || '—'}
                  </span>

                  <span>
                    {extractedData.buyer?.address || '—'}
                  </span>
                </div>
              </section>

            </div>

            {/* Line Items */}
            <section className="details-card">
              <div className="section-heading">
                <div>
                  <h3>Line Items</h3>
                  <p>
                    {extractedData.items?.length || 0} items extracted
                  </p>
                </div>
              </div>

              <div className="table-wrapper">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Description</th>
                      <th>Quantity</th>
                      <th>Unit</th>
                      <th>Unit Price</th>
                      <th>Total</th>
                    </tr>
                  </thead>

                  <tbody>
                    {extractedData.items?.length > 0 ? (
                      extractedData.items.map((item, index) => (
                        <tr key={index}>
                          <td>{item.itemNumber ?? index + 1}</td>
                          <td>{item.description || '—'}</td>
                          <td>{item.quantity ?? '—'}</td>
                          <td>{item.unit || '—'}</td>
                          <td>{formatCurrency(item.unitPrice)}</td>
                          <td className="amount-cell">
                            {formatCurrency(item.totalAmount)}
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6">No items found.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Financial Summary */}
            <section className="summary-card">
              <h3>Invoice Summary</h3>

              <div className="summary-row">
                <span>Subtotal</span>
                <strong>{formatCurrency(extractedData.subtotal)}</strong>
              </div>

              <div className="summary-row">
                <span>
                  {extractedData.tax?.type || 'Tax'}
                  {extractedData.tax?.rate != null
                    ? ` (${extractedData.tax.rate}%)`
                    : ''}
                </span>

                <strong>
                  {formatCurrency(extractedData.tax?.amount)}
                </strong>
              </div>

              <div className="summary-row">
                <span>Discount</span>
                <strong>
                  {formatCurrency(extractedData.discount)}
                </strong>
              </div>

              <div className="summary-row">
                <span>Shipping</span>
                <strong>
                  {formatCurrency(extractedData.shipping)}
                </strong>
              </div>

              <div className="summary-total">
                <span>Grand Total</span>
                <strong>
                  {formatCurrency(extractedData.totalAmount)}
                </strong>
              </div>

              {extractedData.currency && (
                <p className="currency-note">
                  Amounts in {extractedData.currency}
                </p>
              )}
            </section>

            {/* Validation */}
            <section className="validation-card">
              <h3>Validation Results</h3>

              {validation?.isValid ? (
                <p className="validation-success">
                  ✓ All available validation checks passed.
                </p>
              ) : (
                <p className="validation-warning">
                  ⚠ Some information needs your attention.
                </p>
              )}

              {validation?.missingFields?.length > 0 && (
                <div className="validation-list">
                  <strong>Missing information</strong>
                  <ul>
                    {validation.missingFields.map((field) => (
                      <li key={field}>{field}</li>
                    ))}
                  </ul>
                </div>
              )}

              {validation?.warnings?.length > 0 && (
                <div className="validation-list">
                  <strong>Warnings</strong>
                  <ul>
                    {validation.warnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                </div>
              )}
            </section>

            {/* JSON Actions */}
            <section className="actions-section">
              <button
                className="secondary-button"
                onClick={() => setShowJson(!showJson)}
              >
                {showJson ? 'Hide JSON' : 'View JSON'}
              </button>

              <button
                className="primary-button"
                onClick={downloadJson}
              >
                Download JSON
              </button>

              <button
                className="reset-button"
                onClick={resetInvoice}
              >
                Process Another Invoice
              </button>
            </section>

            {showJson && (
              <pre className="json-viewer">
                {JSON.stringify({
                  ...extractedData,
                  validation,
                }, null, 2)}
              </pre>
            )}

          </div>
        )}

      </main>

      <footer className="app-footer">
        Invoice Extractor · Powered by Gemini AI
      </footer>

    </div>
  );
}
