import React from 'react';

const BODY_COPY_CLASS = 'font-body text-base leading-relaxed text-text-secondary';
const SECTION_HEADING_CLASS = 'font-display text-xl font-bold text-text-primary';

export default function AboutPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <h1 className="font-display text-3xl font-bold text-text-primary tracking-tight">
          About StockPulse
        </h1>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_HEADING_CLASS}>How the data works</h2>
        <p className={BODY_COPY_CLASS}>
          StockPulse analyzes S&amp;P 500 companies using official SEC filings
          {' '}
          the same 10-K and 10-Q reports that institutional investors read. We
          normalize 30 years of financial data into consistent, comparable
          metrics across all 500 companies.
        </p>
        <p className={BODY_COPY_CLASS}>
          Market prices refresh every 15 minutes via Yahoo Finance during
          trading hours. Financial statements update nightly from SEC EDGAR.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_HEADING_CLASS}>What you can do</h2>
        <ul className="list-disc pl-5">
          <li className={BODY_COPY_CLASS}>Browse 30 years of annual and quarterly financials</li>
          <li className={BODY_COPY_CLASS}>Compare companies across sectors with the screener</li>
          <li className={BODY_COPY_CLASS}>Run DCF valuations with your own growth assumptions</li>
          <li className={BODY_COPY_CLASS}>Ask the AI copilot questions about any company</li>
          <li className={BODY_COPY_CLASS}>Track real-time price charts with adjustable ranges</li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_HEADING_CLASS}>AI analysis</h2>
        <p className={BODY_COPY_CLASS}>
          The AI copilot uses structured StockPulse data as context to answer
          your questions. It can draw on general financial knowledge when
          StockPulse data does not cover your question. The copilot always
          distinguishes between claims from data and general analysis.
        </p>
        <p className={BODY_COPY_CLASS}>
          Anonymous users get 10 AI queries per day. Signed-in users get 50.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className={SECTION_HEADING_CLASS}>Limitations</h2>
        <p className={BODY_COPY_CLASS}>
          StockPulse is a research tool, not investment advice. Data may be
          delayed. SEC filings reflect reported figures; restatements may not
          be captured immediately. Financial sector DCF results carry
          additional uncertainty due to different capital structures.
        </p>
      </section>

      <footer className="border-t border-border pt-6">
        <p className="font-body text-sm text-text-secondary">
          Built by{' '}
          <a
            href="https://github.com/hiteshsadhwani"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-accent hover:text-accent-hover transition-colors"
          >
            Hitesh Sadhwani
          </a>
        </p>
      </footer>
    </div>
  );
}
