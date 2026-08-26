import { useEffect, useRef, useState } from "react";

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

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false);

  const [turnstileToken, setTurnstileToken] = useState("");
  const turnstileRef = useRef(null);

  useEffect(() => {
    const script = document.createElement("script");

    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;

    script.onload = () => {
      if (window.turnstile && turnstileRef.current) {
        window.turnstile.render(turnstileRef.current, {
          sitekey: import.meta.env.VITE_TURNSTILE_SITE_KEY,
          theme: "auto",
          size: "flexible",
          appearance: "interaction-only",
          // appearance: "always",

          callback: (token) => {
            setTurnstileToken(token);
          },

          "expired-callback": () => {
            setTurnstileToken("");
          },

          "error-callback": () => {
            setTurnstileToken("");
          },
        });
      }
    };

    document.body.appendChild(script);

    return () => {
      script.remove();
    };
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();

    if (!turnstileToken) {
      alert("Please complete the security check before submitting.");
      return;
    }

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    const formData = {
      name: form.get("name"),
      companyName: form.get("companyName"),
      email: form.get("email"),
      phone: form.get("phone"),
      companyType: form.get("companyType"),
      budget: form.get("budget"),
      project: form.get("project"),
      website: form.get("website"),
      turnstileToken,
    };

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Unable to submit form.");
      }

      alert("Thank you! Your project inquiry has been sent.");

      formElement.reset();
    } catch (error) {
      console.error("Form submission error:", error);

      alert(
        "We couldn't send your message. Please email hello@blueprintwebstudio.com directly."
      );
    }
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

        <section id="services" className="services-section page-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Services</p>

              <h2>
                Built around
                <br />
                your business.
              </h2>
            </div>

            <p>
              Every Blueprint website is custom designed, professionally developed,
              and built to support your business long after launch.
            </p>
          </div>

          <div className="service-plans">
            {/* FOUNDATION */}
            <article className="service-plan">
              <div className="service-plan-top">
                <span className="service-number">01</span>

                <div>
                  <span className="service-label">Blueprint</span>
                  <h3>Foundation</h3>
                </div>
              </div>

              <div className="service-price">
                <span>Starting at</span>
                <strong>$6,000</strong>
              </div>

              <p className="service-description">
                For businesses that need a polished, professional website built on a
                strong digital foundation.
              </p>

              <ul className="service-list">
                <li>Custom Website Design</li>
                <li>Responsive Development</li>
                <li>High-Speed Performance</li>
                <li>Professional Cloud Hosting</li>
                <li>HTTPS / SSL Security</li>
                <li>Contact & Lead Generation</li>
                <li>Foundational SEO</li>
                <li>Google Analytics Integration</li>
                <li>Launch & Deployment</li>
              </ul>

              <a href="#contact" className="service-link">
                Start a Foundation Project
                <Icon name="arrow" />
              </a>
            </article>

            {/* BUSINESS */}
            <article className="service-plan service-plan-featured">
              <span className="service-popular">Most Popular</span>

              <div className="service-plan-top">
                <span className="service-number">02</span>

                <div>
                  <span className="service-label">Blueprint</span>
                  <h3>Business</h3>
                </div>
              </div>

              <div className="service-price">
                <span>Starting at</span>
                <strong>$10,000</strong>
              </div>

              <p className="service-description">
                For established businesses where the website plays an important role
                in attracting, converting, and serving customers.
              </p>

              <ul className="service-list">
                <li>Everything in Foundation</li>
                <li>Expanded Pages & Content</li>
                <li>Advanced Lead Generation</li>
                <li>Custom Forms & Integrations</li>
                <li>Google Search Monitoring</li>
                <li>Enhanced SEO</li>
                <li>Conversion Tracking</li>
                <li>Content Migration</li>
                <li>Advanced Animations & Interactions</li>
              </ul>

              <a href="#contact" className="service-link">
                Start a Business Project
                <Icon name="arrow" />
              </a>
            </article>

            {/* PREMIUM */}
            <article className="service-plan">
              <div className="service-plan-top">
                <span className="service-number">03</span>

                <div>
                  <span className="service-label">Blueprint</span>
                  <h3>Premium</h3>
                </div>
              </div>

              <div className="service-price">
                <span>Starting at</span>
                <strong>$15,000+</strong>
              </div>

              <p className="service-description">
                For organizations that need a larger website, sophisticated features,
                or a more customized digital platform.
              </p>

              <ul className="service-list">
                <li>Everything in Business</li>
                <li>Advanced Custom Development</li>
                <li>Third-Party Integrations</li>
                <li>Complex Forms & Workflows</li>
                <li>Advanced SEO Architecture</li>
                <li>Custom Analytics Dashboards</li>
                <li>Multiple Locations or Service Areas</li>
                <li>Expanded Content Architecture</li>
                <li>Custom Project Requirements</li>
              </ul>

              <a href="#contact" className="service-link">
                Discuss a Premium Project
                <Icon name="arrow" />
              </a>
            </article>
          </div>

          {/* WEBSITE MANAGEMENT */}
          <div className="management-card">
            <div className="management-heading">
              <div>
                <p className="section-kicker">Website Management</p>

                <h3>
                  Launch isn't
                  <br />
                  the finish line.
                </h3>
              </div>

              <div className="management-price">
                <span>Starting at</span>
                <strong>$299</strong>
                <small>/ month</small>
              </div>
            </div>

            <div className="management-content">
              <p>
                Blueprint can continue managing the technical side of your website so
                your business doesn't have to.
              </p>

              <div className="management-features">
                <span>Hosting</span>
                <span>Security Monitoring</span>
                <span>Uptime Monitoring</span>
                <span>Website Maintenance</span>
                <span>Form Monitoring</span>
                <span>Analytics</span>
                <span>Minor Content Updates</span>
                <span>Technical Support</span>
                <span>Ongoing Optimization</span>
              </div>

              <a href="#contact" className="service-link">
                Ask About Website Management
                <Icon name="arrow" />
              </a>
            </div>
          </div>
        </section>

        <section id="partner" className="partner-section page-section">
          <div className="section-heading">
            <div>
              <p className="section-kicker">Partner Program</p>

              <h2>
                Built for businesses
                <br />
                worth betting on.
              </h2>
            </div>

            <p>
              Blueprint reserves a limited number of projects each year for
              independent businesses and early-stage companies that could benefit from
              reduced project pricing.
            </p>
          </div>

          <div className="partner-grid">
            {/* SMALL BUSINESS */}
            <article className="partner-card">
              <div className="partner-card-top">
                <span className="partner-number">01</span>

                <div>
                  <span className="partner-label">Partner Program</span>
                  <h3>Small Business</h3>
                </div>
              </div>

              <p className="partner-description">
                For independent businesses investing in a stronger digital presence
                while balancing the realities of operating a growing company.
              </p>

              <div className="partner-highlight">
                <span>Reduced project pricing</span>
                <strong>Available</strong>
              </div>

              <ul className="partner-list">
                <li>Custom Blueprint website</li>
                <li>Same professional development standards</li>
                <li>Flexible project scope</li>
                <li>Ongoing management options</li>
                <li>Limited availability</li>
              </ul>

              <a href="#contact" className="service-link">
                Ask About Small Business Pricing
                <Icon name="arrow" />
              </a>
            </article>

            {/* STARTUP */}
            <article className="partner-card partner-card-featured">
              <span className="partner-badge">Limited Availability</span>

              <div className="partner-card-top">
                <span className="partner-number">02</span>

                <div>
                  <span className="partner-label">Partner Program</span>
                  <h3>Independent Startup</h3>
                </div>
              </div>

              <p className="partner-description">
                For early-stage companies with a strong idea, clear direction, and a
                need for professional web development before they have a full-size
                marketing budget.
              </p>

              <div className="partner-highlight">
                <span>Preferred project rates</span>
                <strong>By Application</strong>
              </div>

              <ul className="partner-list">
                <li>Professional custom website</li>
                <li>Launch-ready digital foundation</li>
                <li>Scalable development approach</li>
                <li>Website management available</li>
                <li>Selected projects only</li>
              </ul>

              <a href="#contact" className="service-link">
                Apply for Startup Pricing
                <Icon name="arrow" />
              </a>
            </article>
          </div>

          <div className="partner-note">
            <p>
              Partner pricing is based on project scope, business stage, and
              availability. Reduced rates do not change Blueprint&apos;s development,
              performance, or quality standards.
            </p>
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
              <span>Prefer E-mail?</span>

              <a
                href="mailto:hello@blueprintwebstudio.com"
                className="contact-email"
              >
                <span className="contact-email-mark" aria-hidden="true" />
                <span>hello@blueprintwebstudio.com</span>
              </a>
            </div>

            <div className="contact-direct">
              <span>Prefer a Call?</span>

              <a
                href="tel:+17205156647"
                className="contact-email"
              >
                <span className="contact-email-mark" aria-hidden="true" />
                <span>(720) 515-6647</span>
              </a>
            </div>

            <div className="socials">
              <a
                href="https://www.instagram.com/blueprint_webstudio/"
                aria-label="Instagram"

              >
                ◎
              </a>

              <a
                href="https://www.linkedin.com/company/143573923/"
                aria-label="LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
              >
                in
              </a>

            </div>
          </div>

          <form className="contact-form" onSubmit={handleSubmit}>

            <div
              style={{
                position: "absolute",
                left: "-9999px",
                width: "1px",
                height: "1px",
                overflow: "hidden",
              }}
              aria-hidden="true"
            >
              <label htmlFor="website">Website</label>
              <input
                type="text"
                id="website"
                name="website"
                tabIndex="-1"
                autoComplete="off"
              />
            </div>

            {/* NAME + COMPANY NAME */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="name">Name <span>*</span></label>

                <input
                  type="text"
                  id="name"
                  name="name"
                  placeholder="Your name"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="companyName">Company Name <span>*</span></label>

                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  placeholder="Your company"
                  required
                />
              </div>
            </div>

            {/* EMAIL + PHONE */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="email">Email <span>*</span></label>

                <input
                  type="email"
                  id="email"
                  name="email"
                  placeholder="you@company.com"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="phone">Phone Number</label>

                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  placeholder="(555) 555-5555"
                />
              </div>
            </div>

            {/* COMPANY TYPE + BUDGET */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyType">Company Type <span>*</span></label>

                <select
                  id="companyType"
                  name="companyType"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select company type
                  </option>

                  <option value="Established Company">
                    Established Company
                  </option>

                  <option value="Small Business">
                    Small Business
                  </option>

                  <option value="Startup">
                    Startup
                  </option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="budget">Budget Range <span>*</span></label>

                <select
                  id="budget"
                  name="budget"
                  required
                  defaultValue=""
                >
                  <option value="" disabled>
                    Select budget range
                  </option>

                  <option value="Under $5,000 — Partner Program">
                    Under $5,000 — Partner Program
                  </option>

                  <option value="$5,000 – $10,000">
                    $5,000 – $10,000
                  </option>

                  <option value="$10,000 – $15,000">
                    $10,000 – $15,000
                  </option>

                  <option value="$15,000 – $25,000">
                    $15,000 – $25,000
                  </option>

                  <option value="$25,000+">
                    $25,000+
                  </option>
                </select>
              </div>
            </div>

            {/* PROJECT */}
            <div className="form-group">
              <label htmlFor="project">What can we help you build? <span>*</span></label>

              <textarea
                id="project"
                name="project"
                rows="6"
                placeholder="Tell us about your business, what you need, and what you'd like the website to accomplish."
                required
              />
            </div>

            <div className="turnstile-wrapper">
              <div ref={turnstileRef}></div>
            </div>

            <button type="submit" className="button button-primary form-button">
              Start a Project
              <Icon name="arrow" />
            </button>
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
              <a href="https://www.instagram.com/blueprint_webstudio/">
                ◎
              </a>
              <a
                href="https://www.linkedin.com/company/143573923/"
                aria-label="LinkedIn"
                target="_blank"
                rel="noopener noreferrer"
              >
                in
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
            <a href="#partner">Partner Program</a>
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