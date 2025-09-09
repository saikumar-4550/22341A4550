import React, { useEffect, useMemo, useState } from 'react';
import './App.css';

function App() {
  const [longUrl, setLongUrl] = useState('');
  const [alias, setAlias] = useState('');
  const [validityMinutes, setValidityMinutes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [shortUrl, setShortUrl] = useState('');
  const [expiresAt, setExpiresAt] = useState(null);
  const [history, setHistory] = useState(() => {
    try {
      const stored = localStorage.getItem('url_history');
      return stored ? JSON.parse(stored) : [];
    } catch (err) {
      return [];
    }
  });

  const apiBaseUrl = useMemo(() => {
    return process.env.REACT_APP_API_BASE_URL || '';
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem('url_history', JSON.stringify(history));
    } catch (err) {
      // ignore storage errors
    }
  }, [history]);

  const isValidHttpUrl = (value) => {
    try {
      const u = new URL(value);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const parseValidityOrDefault = (value) => {
    if (!value || String(value).trim() === '') {
      return 30; // default 30 minutes
    }
    const parsed = Number(String(value).trim());
    if (!Number.isInteger(parsed) || parsed <= 0) {
      return null;
    }
    return parsed;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');
    setShortUrl('');
    setExpiresAt(null);

    if (!longUrl.trim()) {
      setErrorMessage('Please enter a URL to shorten.');
      return;
    }
    if (!isValidHttpUrl(longUrl.trim())) {
      setErrorMessage('Please enter a valid http(s) URL.');
      return;
    }

    const minutes = parseValidityOrDefault(validityMinutes);
    if (minutes === null) {
      setErrorMessage('Validity must be a positive integer (minutes).');
      return;
    }

    setIsLoading(true);
    try {
      const payload = { url: longUrl.trim(), validity: minutes };
      if (alias.trim()) payload.alias = alias.trim();

      const response = await fetch(`${apiBaseUrl}/shorten`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || 'Failed to shorten URL');
      }

      const data = await response.json();
      const generatedShortUrl = data.shortUrl || data.short_url || data.short || '';
      const serverExpiresAt = data.expiresAt || data.expires_at || null;
      if (!generatedShortUrl) {
        throw new Error('Unexpected response from server.');
      }

      const computedExpiry = serverExpiresAt ? Number(serverExpiresAt) : Date.now() + minutes * 60 * 1000;

      setShortUrl(generatedShortUrl);
      setExpiresAt(computedExpiry);
      setHistory((prev) => [
        { longUrl: longUrl.trim(), shortUrl: generatedShortUrl, createdAt: Date.now(), expiresAt: computedExpiry, validityMinutes: minutes },
        ...prev,
      ].slice(0, 20));
      setAlias('');
    } catch (err) {
      setErrorMessage(err.message || 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      // Best-effort fallback
    }
  };

  const handleOpen = (url) => {
    window.open(url, '_blank', 'noreferrer');
  };

  const handleClearHistory = () => {
    setHistory([]);
  };

  return (
    <div className="container">
      <div className="card">
        <h1 className="title">URL Shortener</h1>
        <form className="form" onSubmit={handleSubmit}>
          <label className="label" htmlFor="long-url">Long URL</label>
          <input
            id="long-url"
            className="input"
            type="url"
            placeholder="https://example.com/very/long/url"
            value={longUrl}
            onChange={(e) => setLongUrl(e.target.value)}
            autoFocus
          />

          <label className="label" htmlFor="alias">Custom alias (optional)</label>
          <input
            id="alias"
            className="input"
            type="text"
            placeholder="e.g. my-link"
            value={alias}
            onChange={(e) => setAlias(e.target.value)}
          />

          <label className="label" htmlFor="validity">Validity in minutes (optional, default 30)</label>
          <input
            id="validity"
            className="input"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 30"
            value={validityMinutes}
            onChange={(e) => setValidityMinutes(e.target.value)}
          />

          {errorMessage && <div className="error" role="alert">{errorMessage}</div>}

          <button className="button" type="submit" disabled={isLoading}>
            {isLoading ? 'Shortening…' : 'Shorten URL'}
          </button>
        </form>

        {shortUrl && (
          <div className="result">
            <span className="result-label">Short URL:</span>
            <a className="result-link" href={shortUrl} target="_blank" rel="noreferrer">{shortUrl}</a>
            {expiresAt && (
              <span className="result-label">Expires: {new Date(expiresAt).toLocaleString()}</span>
            )}
            <div className="result-actions">
              <button className="button secondary" onClick={() => handleCopy(shortUrl)}>Copy</button>
              <button className="button secondary" onClick={() => handleOpen(shortUrl)}>Open</button>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="history-header">
          <h2 className="subtitle">Recent</h2>
          {history.length > 0 && (
            <button className="link-button" onClick={handleClearHistory}>Clear</button>
          )}
        </div>
        {history.length === 0 ? (
          <p className="muted">No shortened URLs yet.</p>
        ) : (
          <ul className="history-list">
            {history.map((item, idx) => (
              <li key={idx} className="history-item">
                <div className="history-main">
                  <a className="history-short" href={item.shortUrl} target="_blank" rel="noreferrer">{item.shortUrl}</a>
                  <span className="history-time">{new Date(item.createdAt).toLocaleString()}</span>
                </div>
                <div className="history-sub">
                  <span className="history-long" title={item.longUrl}>{item.longUrl}</span>
                  <div className="history-actions">
                    <span className="history-time">Expires: {new Date(item.expiresAt).toLocaleString()}</span>
                    <button className="button small" onClick={() => handleCopy(item.shortUrl)}>Copy</button>
                    <button className="button small" onClick={() => handleOpen(item.shortUrl)}>Open</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <footer className="footer">
        <span>API Base:</span>
        <code>{apiBaseUrl || '(same origin)'}</code>
      </footer>
    </div>
  );
}

export default App;
