/* ==================================================================
   TaskMe Landing Page — Premium Interactions
   ================================================================== */

(function () {
    'use strict';

    // ===== NAVBAR SCROLL =====
    const navbar = document.getElementById('navbar');

    function handleNavScroll() {
        navbar.classList.toggle('scrolled', window.scrollY > 50);
    }

    window.addEventListener('scroll', handleNavScroll, { passive: true });
    handleNavScroll();

    // ===== MOBILE MENU =====
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const mobileMenu = document.getElementById('mobile-menu');
    const hamburgerIcon = document.getElementById('hamburger-icon');
    const closeIcon = document.getElementById('close-icon');
    let menuOpen = false;

    mobileMenuBtn.addEventListener('click', () => {
        menuOpen = !menuOpen;
        mobileMenu.classList.toggle('hidden', !menuOpen);
        hamburgerIcon.classList.toggle('hidden', menuOpen);
        closeIcon.classList.toggle('hidden', !menuOpen);
    });

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menuOpen = false;
            mobileMenu.classList.add('hidden');
            hamburgerIcon.classList.remove('hidden');
            closeIcon.classList.add('hidden');
        });
    });

    // ===== SMOOTH SCROLL =====
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const id = this.getAttribute('href');
            if (id === '#') return;
            const target = document.querySelector(id);
            if (target) {
                e.preventDefault();
                const offset = navbar.offsetHeight;
                window.scrollTo({
                    top: target.getBoundingClientRect().top + window.pageYOffset - offset,
                    behavior: 'smooth'
                });
            }
        });
    });

    // ===== TYPING ANIMATION =====
    const phrases = [
        'Reimagined with AI',
        'Powered by GPT & Claude',
        'Built for Modern Teams',
        'Effortless & Intelligent'
    ];
    const typingTarget = document.getElementById('typing-target');
    let phraseIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function typeLoop() {
        const current = phrases[phraseIndex];

        if (!isDeleting) {
            typingTarget.textContent = current.slice(0, charIndex + 1);
            charIndex++;
            if (charIndex === current.length) {
                isDeleting = true;
                setTimeout(typeLoop, 2000); // Pause at full phrase
                return;
            }
            setTimeout(typeLoop, 70);
        } else {
            typingTarget.textContent = current.slice(0, charIndex - 1);
            charIndex--;
            if (charIndex === 0) {
                isDeleting = false;
                phraseIndex = (phraseIndex + 1) % phrases.length;
                setTimeout(typeLoop, 400);
                return;
            }
            setTimeout(typeLoop, 40);
        }
    }

    // Start typing after hero animates in
    setTimeout(typeLoop, 900);

    // ===== HERO CURSOR GLOW =====
    const heroSection = document.querySelector('.hero-gradient');
    const heroGlow = document.getElementById('hero-glow');

    if (heroSection && heroGlow) {
        heroSection.addEventListener('mousemove', (e) => {
            const rect = heroSection.getBoundingClientRect();
            heroGlow.style.left = (e.clientX - rect.left) + 'px';
            heroGlow.style.top = (e.clientY - rect.top) + 'px';
        });
    }

    // ===== SCROLL REVEAL (Intersection Observer) =====
    const fadeElements = document.querySelectorAll('.fade-in');

    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                fadeObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    fadeElements.forEach(el => fadeObserver.observe(el));

    // ===== ANIMATED COUNTERS =====
    const counterElements = document.querySelectorAll('[data-count]');
    let countersAnimated = false;

    function animateCounters() {
        if (countersAnimated) return;
        countersAnimated = true;

        counterElements.forEach(el => {
            const target = parseFloat(el.dataset.count);
            const decimals = parseInt(el.dataset.decimals || '0');
            const suffix = el.dataset.suffix || '';
            const parentSuffix = el.parentElement?.querySelector('[data-suffix]')?.dataset.suffix || '';
            const displaySuffix = suffix || parentSuffix;
            const duration = 2000;
            const startTime = performance.now();

            function update(now) {
                const elapsed = now - startTime;
                const progress = Math.min(elapsed / duration, 1);
                // Ease-out cubic
                const eased = 1 - Math.pow(1 - progress, 3);
                const current = target * eased;

                if (decimals > 0) {
                    el.textContent = current.toFixed(decimals) + displaySuffix;
                } else {
                    el.textContent = Math.floor(current).toLocaleString() + displaySuffix;
                }

                if (progress < 1) {
                    requestAnimationFrame(update);
                } else {
                    if (decimals > 0) {
                        el.textContent = target.toFixed(decimals) + displaySuffix;
                    } else {
                        el.textContent = target.toLocaleString() + displaySuffix;
                    }
                }
            }

            requestAnimationFrame(update);
        });
    }

    const counterSection = document.querySelector('.counter-section');
    if (counterSection) {
        const counterObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    counterObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        counterObserver.observe(counterSection);
    }

    // ===== TIMELINE PROGRESS =====
    const timelineLine = document.getElementById('timeline-progress');
    if (timelineLine) {
        const timelineSection = document.getElementById('how-it-works');
        const timelineObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    timelineLine.style.width = '100%';
                    timelineObserver.unobserve(entry.target);
                }
            });
        }, { threshold: 0.3 });

        timelineObserver.observe(timelineSection);
    }

    // ===== PERSPECTIVE TILT ON MOCKUP =====
    const tiltCard = document.querySelector('.tilt-card');
    const perspectiveWrapper = document.querySelector('.perspective-mockup');

    if (tiltCard && perspectiveWrapper && window.innerWidth > 768) {
        perspectiveWrapper.addEventListener('mousemove', (e) => {
            const rect = perspectiveWrapper.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            const rotateX = ((y - centerY) / centerY) * -4;
            const rotateY = ((x - centerX) / centerX) * 4;
            tiltCard.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
        });

        perspectiveWrapper.addEventListener('mouseleave', () => {
            tiltCard.style.transform = 'rotateX(0deg) rotateY(0deg)';
        });
    }

    // ===== PRICING TOGGLE =====
    const pricingToggle = document.getElementById('pricing-toggle');
    const labelMonthly = document.getElementById('label-monthly');
    const labelAnnual = document.getElementById('label-annual');
    const priceAmounts = document.querySelectorAll('.price-amount');
    let isAnnual = false;

    if (pricingToggle) {
        pricingToggle.addEventListener('click', () => {
            isAnnual = !isAnnual;
            pricingToggle.classList.toggle('active', isAnnual);

            labelMonthly.classList.toggle('text-gray-900', !isAnnual);
            labelMonthly.classList.toggle('font-semibold', !isAnnual);
            labelMonthly.classList.toggle('text-gray-400', isAnnual);
            labelMonthly.classList.toggle('font-medium', isAnnual);

            labelAnnual.classList.toggle('text-gray-900', isAnnual);
            labelAnnual.classList.toggle('font-semibold', isAnnual);
            labelAnnual.classList.toggle('text-gray-400', !isAnnual);
            labelAnnual.classList.toggle('font-medium', !isAnnual);

            priceAmounts.forEach(el => {
                const price = isAnnual ? el.dataset.annual : el.dataset.monthly;
                el.textContent = '$' + price;
            });
        });
    }

    // ===== TESTIMONIAL CAROUSEL =====
    const carouselTrack = document.getElementById('carousel-track');
    const carouselDots = document.querySelectorAll('.carousel-dot');
    const slides = document.querySelectorAll('.carousel-slide');
    let currentSlide = 0;
    let autoSlideInterval;
    const isMobile = window.innerWidth < 768;

    function goToSlide(index) {
        currentSlide = index;
        const offset = isMobile ? index * 100 : index * 33.333;
        carouselTrack.style.transform = `translateX(-${offset}%)`;

        carouselDots.forEach((dot, i) => {
            dot.classList.toggle('active', i === index);
        });
    }

    function nextSlide() {
        const maxSlide = isMobile ? slides.length - 1 : 0;
        goToSlide(currentSlide >= maxSlide ? 0 : currentSlide + 1);
    }

    carouselDots.forEach(dot => {
        dot.addEventListener('click', () => {
            goToSlide(parseInt(dot.dataset.index));
            resetAutoSlide();
        });
    });

    function resetAutoSlide() {
        clearInterval(autoSlideInterval);
        if (isMobile) {
            autoSlideInterval = setInterval(nextSlide, 5000);
        }
    }

    if (isMobile) {
        autoSlideInterval = setInterval(nextSlide, 5000);
    }

    // ===== FAQ ACCORDION =====
    const faqItems = document.querySelectorAll('.faq-item');

    faqItems.forEach(item => {
        const toggle = item.querySelector('.faq-toggle');
        const content = item.querySelector('.faq-content');

        toggle.addEventListener('click', () => {
            const isActive = item.classList.contains('active');

            // Close all
            faqItems.forEach(other => {
                other.classList.remove('active');
                other.querySelector('.faq-content').style.maxHeight = '0';
            });

            // Open clicked if it was closed
            if (!isActive) {
                item.classList.add('active');
                content.style.maxHeight = content.scrollHeight + 'px';
            }
        });
    });

    // ===== ACTIVE NAV HIGHLIGHT =====
    const sections = document.querySelectorAll('section[id]');

    function highlightNav() {
        const scrollPos = window.scrollY + navbar.offsetHeight + 120;

        sections.forEach(section => {
            const top = section.offsetTop;
            const height = section.offsetHeight;
            const id = section.getAttribute('id');

            if (scrollPos >= top && scrollPos < top + height) {
                document.querySelectorAll('.nav-link').forEach(link => {
                    const isActive = link.getAttribute('href') === `#${id}`;
                    link.classList.toggle('font-bold', isActive);
                    link.classList.toggle('font-medium', !isActive);
                });
            }
        });
    }

    window.addEventListener('scroll', highlightNav, { passive: true });

})();
