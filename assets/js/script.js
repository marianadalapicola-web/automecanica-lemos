/* ==========================================================================
   mariana.dev — interações
   ========================================================================== */

/* ---------- menu mobile ---------- */
const burgerBtn  = document.getElementById('burgerBtn');
const mobileMenu = document.getElementById('mobileMenu');

if (burgerBtn && mobileMenu) {
  burgerBtn.addEventListener('click', () => {
    const isOpen = mobileMenu.classList.toggle('is-open');
    burgerBtn.classList.toggle('is-open', isOpen);
    burgerBtn.setAttribute('aria-expanded', String(isOpen));
  });

  mobileMenu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => {
      mobileMenu.classList.remove('is-open');
      burgerBtn.classList.remove('is-open');
      burgerBtn.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ---------- animação de entrada ao rolar a página ---------- */
const revealEls = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  revealEls.forEach((el) => observer.observe(el));
} else {
  revealEls.forEach((el) => el.classList.add('is-visible'));
}

/* ==========================================================================
   PROJETOS — edite este array para trocar os projetos do portfólio.
   color: define a cor de fundo do "mockup" do card (pink | lilac | yellow | coral | dark)
   size:  "full" ocupa a largura toda, "half" ocupa metade (2 por linha)
   ========================================================================== */
const projects = [
  {
    title: 'Projeto Aurora',
    category: 'Landing Page',
    description: 'Página de conversão criada para apresentar um produto e captar clientes.',
    color: 'pink',
    size: 'full',
    link: '#',
  },
  {
    title: 'Estúdio Nômade',
    category: 'Site Institucional',
    description: 'Site institucional com foco em credibilidade e apresentação de serviços.',
    color: 'lilac',
    size: 'half',
    link: '#',
  },
  {
    title: 'Studio Menta',
    category: 'Portfólio',
    description: 'Portfólio pessoal para exibir projetos e atrair novos clientes.',
    color: 'yellow',
    size: 'half',
    link: '#',
  },
  {
    title: 'Loja Cravo',
    category: 'E-commerce',
    description: 'Loja virtual pensada para uma jornada de compra simples e agradável.',
    color: 'dark',
    size: 'full',
    link: '#',
  },
];

const projectsGrid = document.getElementById('projectsGrid');

if (projectsGrid) {
  projectsGrid.innerHTML = projects
    .map((project, index) => {
      const num = String(index + 1).padStart(2, '0');
      const isFull = project.size === 'full';
      return `
        <a class="p-card${isFull ? ' is-full' : ''}" href="${project.link}" data-color="${project.color}">
          <div class="p-card__frame mock--${project.color}-bg">
            <div class="p-card__browser"><span></span><span></span><span></span></div>
            <span class="p-card__mark">${project.title}</span>
            <span class="p-card__cta">Ver projeto &rarr;</span>
          </div>
          <div class="p-card__body">
            <div>
              <span class="p-card__cat">${project.category}</span>
              <span class="p-card__title">${project.title}</span>
              <p class="p-card__desc">${project.description}</p>
            </div>
            <span class="p-card__num">${num}</span>
          </div>
        </a>
      `;
    })
    .join('');

  document.querySelectorAll('.reveal').forEach((el) => {
    if (!el.dataset.observed) {
      el.dataset.observed = 'true';
    }
  });

  // observa os cards de projeto recém-criados para a animação de entrada
  if ('IntersectionObserver' in window) {
    const cardObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
            cardObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1 }
    );
    projectsGrid.querySelectorAll('.p-card').forEach((card, i) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(24px)';
      card.style.transition = `opacity .6s ease ${i * 0.06}s, transform .6s ease ${i * 0.06}s`;
      cardObserver.observe(card);
    });
  }
}
