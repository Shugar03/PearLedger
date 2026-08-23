import type { ReactNode } from 'react'

import { logoWordmarkInvert } from '@site/assets'

import '@site/sections/Footer.css'

/** Pie: marca, enlaces y aviso legal. */
export function Footer(): ReactNode {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <div className="footer__brand">
          <img
            className="footer__logo"
            src={logoWordmarkInvert}
            alt="PearLedger"
            width="1300"
            height="547"
          />
          <p className="footer__tagline">
            Local-first · Gasless · P2P · Operational sovereignty
          </p>
        </div>
        <nav className="footer__nav" aria-label="Footer">
          <div className="footer__group">
            <h2 className="footer__group-title">
              Product
            </h2>
            <ul>
              <li>
                <a href="#producto">
                  {' Dashboard '}
                </a>
              </li>
              <li>
                <a href="#como-funciona">
                  {' How it works '}
                </a>
              </li>
              <li>
                <a href="#empezar">
                  {' Get started '}
                </a>
              </li>
            </ul>
          </div>
          <div className="footer__group">
            <h2 className="footer__group-title">
              Technology
            </h2>
            <ul>
              <li>
                <a href="#arquitectura">
                  {' Architecture '}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Shugar03/PearLedger/blob/main/docs/PLUGIN_CONTRACT.md"
                  target="_blank"
                  rel="noopener"
                >
                  {' Plugin contract '}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Shugar03/PearLedger/blob/main/docs/STACK_ANALYSIS.md"
                  target="_blank"
                  rel="noopener"
                >
                  {' Stack analysis '}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Shugar03/PearLedger/blob/main/harness/core.ts"
                  target="_blank"
                  rel="noopener"
                >
                  {' Harness '}
                </a>
              </li>
            </ul>
          </div>
          <div className="footer__group">
            <h2 className="footer__group-title">
              Security
            </h2>
            <ul>
              <li>
                <a href="#seguridad">
                  {' Privacy '}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Shugar03/PearLedger/blob/main/harness/hooks.ts"
                  target="_blank"
                  rel="noopener"
                >
                  {' Confirmation hook '}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Shugar03/PearLedger/blob/main/harness/hooks.ts"
                  target="_blank"
                  rel="noopener"
                >
                  {' Input sanitization '}
                </a>
              </li>
            </ul>
          </div>
          <div className="footer__group">
            <h2 className="footer__group-title">
              Documentation
            </h2>
            <ul>
              <li>
                <a href="https://github.com/Shugar03/PearLedger" target="_blank" rel="noopener">
                  {' README '}
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/Shugar03/PearLedger/blob/main/docs/ROADMAP.md"
                  target="_blank"
                  rel="noopener"
                >
                  {' Roadmap '}
                </a>
              </li>
              <li>
                <a href="https://github.com/Shugar03/PearLedger" target="_blank" rel="noopener">
                  {' GitHub '}
                </a>
              </li>
            </ul>
          </div>
        </nav>
        <div className="footer__meta">
          <span>
            © 2026 PearLedger · Apache-2.0
          </span>
          <span>
            Local financial operations agent.
          </span>
        </div>
      </div>
    </footer>
  )
}
