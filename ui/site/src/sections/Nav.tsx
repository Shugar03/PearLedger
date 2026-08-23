import type { ReactNode } from 'react'

import { logoMark, logoWordmark } from '@site/assets'

import '@site/sections/Nav.css'

/** Barra superior: marca, anclas a las secciones y cambio de idioma. */
export function Nav(): ReactNode {
  return (
    <header className="nav">
      <div className="wrap nav__inner">
        <a className="nav__brand" href="/en/" aria-label="PearLedger">
          {' '}
          <img className="nav__logo" src={logoWordmark} alt="PearLedger" width="1300" height="547" />
          {' '}
          <img className="nav__logo-mark" src={logoMark} alt="PearLedger" width="260" height="422" />
          {' '}
        </a>
        <nav className="nav__links" aria-label="Sections">
          <a href="#producto">
            Product
          </a>
          <a href="#como-funciona">
            How it works
          </a>
          <a href="#seguridad">
            Security
          </a>
          <a href="#arquitectura">
            Architecture
          </a>
        </nav>
        <div className="nav__actions">
          <a className="nav__lang" href="/" aria-label="Cambiar a español">
            {' '}
            <span className="nav__lang-current">
              EN
            </span>
            {' '}
            <span className="nav__lang-alt">
              ES
            </span>
            {' '}
          </a>
          <a className="btn btn--primary btn--sm" href="#empezar">
            {' Sign up '}
          </a>
        </div>
      </div>
    </header>
  )
}
