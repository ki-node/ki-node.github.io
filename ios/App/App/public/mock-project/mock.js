const names = {
  portfolio: 'Portfolio',
  poster: 'Poster',
  blackbox: 'Blackbox',
};

const params = new URLSearchParams(window.location.search);
const project = params.get('project') ?? 'portfolio';
const source = params.get('source') === 'embedded' ? 'App-Build' : 'Web-Build';
const title = names[project] ?? 'Projekt';

document.querySelector('[data-title]').textContent = title;
document.querySelector('[data-source]').textContent = source;
document.title = `${title} – ki-node Mock`;
