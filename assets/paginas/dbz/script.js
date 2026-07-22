
const urlParams = new URLSearchParams(window.location.search);
const textoGenerado = urlParams.get('texto') || '';


const textoGeneradoElement = document.getElementById('texto-generado');
textoGeneradoElement.innerText = textoGenerado || '¡Escribe texto en la URL usando ?texto=TU_TEXTO';
textoGeneradoElement.classList.add('custom-text');
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
const images = [
    { src: 'db1.jpg', color: '#f3d804' },
    { src: 'db2.jpg', color: '#f3d804' }
];
const randomIndex = getRandomInt(0, images.length - 1);
const selectedImage = images[randomIndex];
const imageElement = document.getElementById('imagen');
imageElement.src = selectedImage.src;
imageElement.style.width = '853px';
imageElement.style.height = '480px';
const textContainer = document.createElement('div');
textContainer.classList.add('text-container');
textContainer.style.position = 'absolute'; 
textContainer.style.zIndex = '2'; 
textContainer.style.width = '853px';
textContainer.style.height = '480px';
textContainer.style.top = '0';
textContainer.style.left = '0';
textContainer.style.display = 'flex';
textContainer.style.justifyContent = 'center';
textContainer.style.alignItems = 'center';
document.body.appendChild(textContainer);
textContainer.appendChild(textoGeneradoElement);
const customText = document.querySelector('.custom-text');
customText.style.color = selectedImage.color;
customText.style.fontSize = '70px'; 
customText.style.textAlign = 'center';
customText.style.textShadow = '3px 3px 5px rgba(0, 0, 0, 0.3)'; 
function ajustarTamañoLetra() {
    const container = document.querySelector('.text-container');
    const texto = document.querySelector('.custom-text');

    let fontSize = 45;

    while (texto.scrollWidth > container.clientWidth || texto.scrollHeight > container.clientHeight) {
        fontSize--;
        texto.style.fontSize = fontSize + 'px';
    }
}

ajustarTamañoLetra();
window.addEventListener('resize', ajustarTamañoLetra);
