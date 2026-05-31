import { useState } from "react";

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const services = [
    {
      number: "01",
      title: "Strategy",
      desc: "A clear digital direction before design begins. We define the audience, goals, pages, and conversion path.",
    },
    {
      number: "02",
      title: "Design",
      desc: "Refined visual systems that feel intentional, premium, and aligned with your business.",
    },
    {
      number: "03",
      title: "Development",
      desc: "Fast, responsive websites built with clean code, strong structure, and long-term scalability.",
    },
    {
      number: "04",
      title: "Support",
      desc: "Launch support, ongoing updates, hosting guidance, and improvements after your site goes live.",
    },
  ];

  return (
    <main className="site-shell">
      <header className="nav">
        <a href="#" className="brand">
          Blueprint<span>Digital</span>
        </a>

        <nav className="desktop-nav">
          <a href="#services">Services</a>
          <a href="#work">Work</a>
          <a href="#process">Process</a>
          <a href="#about">About</a>
          <a href="#contact" className="nav-cta">Start a Project</a>
        </nav>

        <button
          className="menu-button"
          onClick={() => setMenuOpen(!menuOpen)}
          type="button"
        >
          {menuOpen ? "✕" : "☰"}
        </button>
      </header>

      {menuOpen && (
        <nav className="mobile-nav">
          <a href="#services">Services</a>
          <a href="#work">Work</a>
          <a href="#process">Process</a>
          <a href="#about">About</a>
          <a href="#contact">Start a Project</a>
        </nav>
      )}

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Professional Web Design & Development</p>

          <h1>Websites engineered for business success.</h1>

          <p className="hero-text">
            Blueprint Digital creates refined, high-performing websites for
            founders, studios, and service businesses that need more than a
            generic online presence.
          </p>

          <div className="hero-actions">
            <a href="#contact" className="primary-button">
              Start a Project
            </a>
            <a href="#work" className="secondary-button">
              View Work
            </a>
          </div>
        </div>

        <div className="hero-card">
          <div className="browser-dots">
            <span />
            <span />
            <span />
          </div>

          <div className="mock-site">
            <p>Featured Build</p>
            <h2>Refined digital presence for a premium service brand.</h2>
            <div className="mock-line wide" />
            <div className="mock-line" />
            <div className="mock-grid">
              <div />
              <div />
              <div />
              <div />
            </div>
          </div>
        </div>
      </section>

      <section id="services" className="section">
        <div className="section-heading">
          <p className="eyebrow">Services</p>
          <h2>Strategy, design, and development with intention.</h2>
        </div>

        <div className="service-grid">
          {services.map((service) => (
            <article className="service-card" key={service.title}>
              <p>{service.number}</p>
              <h3>{service.title}</h3>
              <span>{service.desc}</span>
            </article>
          ))}
        </div>
      </section>

      <section id="work" className="featured-work">
        <div>
          <p className="eyebrow">Selected Work</p>
          <h2>One strong website is better than ten forgettable ones.</h2>
          <p>
            Every build is approached like a digital foundation: clear structure,
            elevated visuals, clean performance, and a user experience that
            supports real business goals.
          </p>
        </div>

        <div className="case-study">
          <p>Case Study</p>
          <h3>Premium Business Website</h3>
          <span>
            Brand direction, responsive design, development, SEO structure, and
            launch support.
          </span>
          <a href="#contact">Discuss a similar project →</a>
        </div>
      </section>

      <section id="process" className="section process-section">
        <div className="section-heading">
          <p className="eyebrow">Process</p>
          <h2>A precise path from idea to launch.</h2>
        </div>

        <div className="process-list">
          <div>
            <strong>01</strong>
            <h3>Discover</h3>
            <p>Clarify your business, audience, competitors, and goals.</p>
          </div>

          <div>
            <strong>02</strong>
            <h3>Design</h3>
            <p>Create a polished visual direction before development begins.</p>
          </div>

          <div>
            <strong>03</strong>
            <h3>Build</h3>
            <p>Develop a fast, responsive, production-ready website.</p>
          </div>

          <div>
            <strong>04</strong>
            <h3>Launch</h3>
            <p>Deploy, refine, and support the site after it goes live.</p>
          </div>
        </div>
      </section>

      <section id="about" className="about">
        <p className="eyebrow">Why Blueprint Digital?</p>
        <h2>Engineering precision meets boutique design.</h2>
        <p>
          Most websites are assembled. Blueprint Digital is built around a more
          intentional process: structure first, design second, development with
          discipline. The result is a website that feels elevated, works
          smoothly, and gives your business a stronger digital foundation.
        </p>
      </section>

      <section id="contact" className="contact">
        <p className="eyebrow">Start a Project</p>
        <h2>Ready to build a better digital presence?</h2>
        <p>
          Let’s create a website that separates your business from the rest.
        </p>
        <a href="mailto:hello@blueprintdigital.com" className="primary-button">
          hello@blueprintdigital.com
        </a>
      </section>

      <footer className="footer">
        <p>Blueprint Digital</p>
        <span>© 2026 Blueprint Digital. All rights reserved.</span>
      </footer>
    </main>
  );
}