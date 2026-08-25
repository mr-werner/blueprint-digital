import { useState } from "react";

const Icon = ({ name }) => {
  const paths = {
    speed: (
      <>
        <path d="M4 16a8 8 0 1 1 16 0" />
        <path d="M12 12l4-4" />
        <path d="M12 16h.01" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3l7 3v5c0 4.5-3 7.7-7 10-4-2.3-7-5.5-7-10V6l7-3z" />
        <path d="M9 12l2 2 4-4" />
      </>
    ),
    growth: (
      <>
        <path d="M4 18l5-5 4 4 7-8" />
        <path d="M15 9h5v5" />
      </>
    ),
    support: (
      <>
        <path d="M5 14v-2a7 7 0 0 1 14 0v2" />
        <path d="M5 14h2v5H5z" />
        <path d="M17 14h2v5h-2z" />
        <path d="M17 19c0 1-1 2-3 2h-2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="M14 7l5 5-5 5" />
      </>
    ),
    store: (
      <>
        <path d="M4 10h16" />
        <path d="M5 10l1-5h12l1 5" />
        <path d="M6 10v9h12v-9" />
        <path d="M9 19v-5h6v5" />
      </>
    ),
    rocket: (
      <>
        <path d="M14 5c3-2 5-2 5-2s0 2-2 5l-5 5-4-4 6-4z" />
        <path d="M8 9H5l-2 3 4 1" />
        <path d="M12 13v3l-3 2-1-4" />
        <path d="M7 17l-2 2" />
      </>
    ),
  };

  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
};

const serviceGroups = [
  {
    category: "The Foundation",
    items: [
      ["Website Hosting", true, true, true, true],
      ["Business Email Integration", true, true, true, true],
      ["HTTPS / SSL", true, true, true, true],
    ],
  },
  {
    category: "Better Technology",
    items: [
      ["High-Speed Performance", false, true, true, true],
      ["Reliable Cloud Hosting", false, true, true, true],
      ["AI-Assisted Optimization", false, true, true, true],
    ],
  },
  {
    category: "Protection & Care",
    items: [
      ["Security & Bot Protection", false, false, true, true],
      ["Ongoing Maintenance", false, false, true, true],
      ["Website Monitoring", false, false, true, true],
    ],
  },
  {
    category: "Growth & Visibility",
    items: [
      ["Google Search Monitoring", false, false, false, true],
      ["Search Engine Optimization", false, false, false, true],
      ["Analytics & Growth Insights", false, false, false, true],
    ],
  },
];

function Status({ included }) {
  return (
    <span className={included ? "included" : "excluded"}>
      {included ? "✓" : "—"}
    </span>
  );
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSubmit(event) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const name = form.get("name");
    const email = form.get("email");
    const company = form.get("company");
    const message = form.get("message");

    const subject = encodeURIComponent(
      `Blueprint WebStudio inquiry from ${name}`
    );

    const body = encodeURIComponent(
      `Name: ${name}\nEmail: ${email}\nCompany: ${company || "Not provided"
      }\n\nProject Details:\n${message}`
    );

    window.location.href = `mailto:hello@blueprintwebstudio.com?subject=${subject}&body=${body}`;
  }

  return (
    <div id="top" className="site">
      <header className="header">
        <a href="#top" className="header-logo" aria-label="Blueprint WebStudio">
          <img
            className="header-mark"
            src="/blueprint-webstudio-logo.png"
            alt=""
            aria-hidden="true"
          />

          <img
            className="header-wordmark"
            src="/blueprint-webstudio-text.png"
            alt="Blueprint WebStudio"
          />
        </a>

        <nav className="desktop-nav" aria-label="Primary navigation">
          <a href="#services">Services</a>
          <a href="#process">Process</a>
          <a href="#about">Why Blueprint?</a>
          <a href="#contact">Contact</a>

          <a href="#contact" className="nav-button">
            Start Your Project
          </a>
        </nav>

        <button
          className="menu-toggle"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen && (
        <nav className="mobile-nav">
          {[
            ["Services", "#services"],
            ["Process", "#process"],
            ["Why Blueprint?", "#about"],
            ["Contact", "#contact"],
          ].map(([label, href]) => (
            <a
              href={href}
              key={label}
              onClick={() => setMenuOpen(false)}
            >
              {label}
            </a>
          ))}

          <a
            href="#contact"
            className="mobile-project-button"
            onClick={() => setMenuOpen(false)}
          >
            Start Your Project
          </a>
        </nav>
      )}

      <main>
        <section className="hero">
          <div className="hero-blueprint-grid" />

          <div className="hero-copy">
            <p className="hero-eyebrow">
              Websites engineered for business success.
            </p>

            <h1>
              Custom Websites.
              <br />
              Powerful Results.
            </h1>

            <p className="hero-description">
              We design and build high-performance websites that look
              exceptional, communicate clearly, and turn visitors into
              customers.
            </p>

            <div className="hero-actions">
              <a href="#contact" className="button button-primary">
                Start Your Project
                <Icon name="arrow" />
              </a>

              <a href="#services" className="button button-outline">
                Explore Services
              </a>
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-logo-panel">
              <img
                className="hero-logo-image"
                src="/blueprint-webstudio-logo-text.png"
                alt="Blueprint WebStudio"
              />
            </div>
          </div>
        </section>

        <section className="benefit-strip">
          <div className="benefit">
            <div className="benefit-icon">
              <Icon name="speed" />
            </div>

            <div>
              <strong>High Performance</strong>
              <span>Lightning-fast load times</span>
            </div>
          </div>

          <div className="benefit">
            <div className="benefit-icon">
              <Icon name="shield" />
            </div>

            <div>
              <strong>Secure & Reliable</strong>
              <span>Protection you can trust</span>
            </div>
          </div>

          <div className="benefit">
            <div className="benefit-icon">
              <Icon name="growth" />
            </div>

            <div>
              <strong>SEO Optimized</strong>
              <span>Built to rank, built to grow</span>
            </div>
          </div>

          <div className="benefit">
            <div className="benefit-icon">
              <Icon name="support" />
            </div>

            <div>
              <strong>Ongoing Support</strong>
              <span>We're here when you need us</span>
            </div>
          </div>
        </section>

        <section id="deals" className="deals-section page-section">
          <div className="deals-intro">
            <p className="section-kicker">Special Programs</p>

            <h2>
              Built for Your
              <br />
              Business Goals
            </h2>

            <p>
              Choose the service level that fits your business, then see whether
              you qualify for one of our special programs designed to make
              premium web development more attainable.
            </p>
          </div>

          <article className="deal-card small-business-card">
            <div className="deal-icon deal-icon-green">
              <Icon name="store" />
            </div>

            <div>
              <span className="deal-number">50% OFF</span>
              <h3>Small Business Program</h3>

              <p>
                For qualifying established independent businesses ready to
                improve their digital presence.
              </p>

              <a href="#contact">
                Learn More
                <Icon name="arrow" />
              </a>
            </div>
          </article>

          <article className="deal-card startup-card">
            <div className="deal-icon deal-icon-blue">
              <Icon name="rocket" />
            </div>

            <div>
              <span className="deal-number">75% OFF</span>
              <h3>Startup Program</h3>

              <p>
                For qualifying independent startups building their brand and
                launching their first professional website.
              </p>

              <a href="#contact">
                Learn More
                <Icon name="arrow" />
              </a>
            </div>
          </article>
        </section>

        <section id="services" className="services-section page-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Services</p>
              <h2>
                More than
                <br />
                just a website.
              </h2>
            </div>

            <p>
              Choose the level of technology, protection, support, and
              visibility that fits your business.
            </p>
          </div>

          <div className="comparison-scroll">
            <div className="comparison-table">
              <div className="comparison-head feature-head">
                What You Get
              </div>

              <div className="comparison-head muted-plan">
                <span>Typical</span>
                <strong>Others</strong>
              </div>

              <div className="comparison-head">
                <span>Blueprint</span>
                <strong>Basic</strong>
              </div>

              <div className="comparison-head highlighted-plan">
                <small>Most Popular</small>
                <span>Blueprint</span>
                <strong>Standard</strong>
              </div>

              <div className="comparison-head">
                <span>Blueprint</span>
                <strong>Premium</strong>
              </div>

              {serviceGroups.map((group) => (
                <div className="comparison-group" key={group.category}>
                  <div className="comparison-category">{group.category}</div>

                  {group.items.map(
                    ([name, others, basic, standard, premium]) => (
                      <div className="comparison-row" key={name}>
                        <div className="comparison-name">{name}</div>

                        <div className="comparison-cell">
                          <Status included={others} />
                        </div>

                        <div className="comparison-cell">
                          <Status included={basic} />
                        </div>

                        <div className="comparison-cell standard-cell">
                          <Status included={standard} />
                        </div>

                        <div className="comparison-cell">
                          <Status included={premium} />
                        </div>
                      </div>
                    )
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>


        <section id="process" className="process-section">
          <div className="process-heading">
            <p className="section-kicker light-kicker">Our Process</p>

            <h2>
              Structured.
              <br />
              Intentional.
              <br />
              Built to perform.
            </h2>

            <p>
              A clear development process keeps every project focused on your
              business instead of unnecessary complexity.
            </p>
          </div>

          <div className="process-steps">
            <article>
              <span>01</span>
              <h3>Discover</h3>
              <p>
                We learn about your business, audience, goals, competition,
                and what your website needs to accomplish.
              </p>
            </article>

            <article>
              <span>02</span>
              <h3>Design</h3>
              <p>
                We create the visual direction, structure, content hierarchy,
                and user experience.
              </p>
            </article>

            <article>
              <span>03</span>
              <h3>Build</h3>
              <p>
                Your design becomes a fast, responsive, secure production
                website.
              </p>
            </article>

            <article>
              <span>04</span>
              <h3>Launch & Grow</h3>
              <p>
                We launch the site and can continue supporting, monitoring,
                maintaining, and improving it.
              </p>
            </article>
          </div>
        </section>

        <section id="about" className="about-section page-section">
          <div className="about-logo-wrap">
            <div className="about-logo-grid" />

            <img
              src="/blueprint-webstudio-logo-text.png"
              alt="Blueprint WebStudio fingerprint logo"
            />
          </div>

          <div className="about-copy">
            <p className="section-kicker">Why Blueprint?</p>

            <h2>
              Engineering precision meets modern digital design.
            </h2>

            <p>
              Blueprint WebStudio approaches websites as engineered business
              tools. Every project combines deliberate structure, strong
              visual design, modern development, performance, and a clear
              customer path.
            </p>

            <p>
              The goal isn't simply to make your website look newer. It's to
              create a stronger digital foundation for your business.
            </p>

            <a href="#contact" className="text-link">
              Work With Blueprint
              <Icon name="arrow" />
            </a>
          </div>
        </section>

        <section id="contact" className="contact-section">
          <div className="contact-copy">
            <p className="section-kicker light-kicker">Start a Project</p>

            <h2>
              Let's build
              <br />
              something great.
            </h2>

            <p>
              Tell us about your business, your current website, and what
              you'd like to improve.
            </p>

            <div className="contact-direct">
              <span>Prefer email?</span>

              <a href="mailto:hello@blueprintwebstudio.com">
                hello@blueprintwebstudio.com
              </a>
            </div>

            <div className="socials">
              <a
                href="#"
                aria-label="Facebook"
                onClick={(event) => event.preventDefault()}
              >
                f
              </a>

              <a
                href="#"
                aria-label="Instagram"
                onClick={(event) => event.preventDefault()}
              >
                ◎
              </a>

              <a
                href="#"
                aria-label="LinkedIn"
                onClick={(event) => event.preventDefault()}
              >
                in
              </a>

              <a
                href="#"
                aria-label="YouTube"
                onClick={(event) => event.preventDefault()}
              >
                ▶
              </a>
            </div>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>
            <div className="field-row">
              <label>
                <span>Name *</span>
                <input
                  type="text"
                  name="name"
                  placeholder="Your name"
                  required
                />
              </label>

              <label>
                <span>Email *</span>
                <input
                  type="email"
                  name="email"
                  placeholder="you@company.com"
                  required
                />
              </label>
            </div>

            <label>
              <span>Company</span>
              <input
                type="text"
                name="company"
                placeholder="Business or company name"
              />
            </label>

            <label>
              <span>What can we help you build? *</span>
              <textarea
                name="message"
                rows="7"
                placeholder="Tell us a little about your project..."
                required
              />
            </label>

            <button type="submit" className="button button-primary form-button">
              Send Project Inquiry
              <Icon name="arrow" />
            </button>

            <small>
              This currently opens your email application. We can connect the
              form directly to Resend later.
            </small>
          </form>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-main">
          <div className="footer-brand">
            <a href="#top">
              <img
                src="/blueprint-webstudio-logo-text.png"
                alt="Blueprint WebStudio"
              />
            </a>

            <p>
              Custom websites engineered for business success.
              <br />
              Design. Develop. Grow.
            </p>

            <div className="footer-socials">
              <a href="#" onClick={(e) => e.preventDefault()}>
                f
              </a>
              <a href="#" onClick={(e) => e.preventDefault()}>
                ◎
              </a>
              <a href="#" onClick={(e) => e.preventDefault()}>
                in
              </a>
              <a href="#" onClick={(e) => e.preventDefault()}>
                ▶
              </a>
            </div>
          </div>

          <div className="footer-column">
            <strong>Services</strong>
            <a href="#services">Custom Websites</a>
            <a href="#services">SEO & Analytics</a>
            <a href="#services">Website Management</a>
            <a href="#services">Security & Monitoring</a>
            <a href="#services">Branding & Design</a>
          </div>

          <div className="footer-column">
            <strong>Company</strong>
            <a href="#about">Why Blueprint?</a>
            <a href="#process">Our Process</a>
            <a href="#contact">Contact</a>
          </div>

          <div className="footer-cta">
            <strong>Let's Build Something Great</strong>

            <p>
              Ready to take your online presence to the next level? We'd love
              to hear about your project.
            </p>

            <a href="#contact" className="footer-button">
              Start Your Project
            </a>
          </div>
        </div>

        <div className="footer-bottom">
          <div className="copyright">
            <span className="copyright-mark" aria-hidden="true" />
            <span>
              © 2026 Blueprint WebStudio. All rights reserved.
            </span>
          </div>

          <div className="legal-links">
            <a href="#">Privacy Policy</a>
            <span />
            <a href="#">Terms of Service</a>
          </div>
        </div>
      </footer>
    </div>
  );
}