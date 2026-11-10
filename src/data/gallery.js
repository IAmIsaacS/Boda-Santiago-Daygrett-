// Galería de fotografías de la colección
import image1 from '../assets/carrusel/1.jpeg';
import image2 from '../assets/carrusel/2.jpeg';
import image3 from '../assets/carrusel/3.jpeg';
import image4 from '../assets/carrusel/4.jpeg';
import image5 from '../assets/carrusel/5.jpeg';

// Astro entrega un objeto ImageMetadata; Vite puede entregar un string.
const imageSrc = (image) => (typeof image === 'string' ? image : image.src);

export const galleryItems = [
  {
    main: imageSrc(image1),
    caption: 'El comienzo de nuestro para siempre',
  },
  {
    main: imageSrc(image2),
    caption: 'Un camino que elegimos juntos',
  },
  {
    main: imageSrc(image3),
    caption: 'La complicidad que nos define',
  },
  {
    main: imageSrc(image4),
    caption: 'El primer instante de un sí eterno',
  },
  {
    main: imageSrc(image5),
    caption: 'Nuestro amor en cada mirada',
  },
];
