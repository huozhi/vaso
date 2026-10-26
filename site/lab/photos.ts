// Photos already used on the main site (Unsplash), plus the local flower
const u = (id: string, w = 800) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80&auto=format&fit=crop`

export const PHOTOS = {
  alpine: u('1693051177268-6ad61ebc92a2'),
  forest: u('1719531325944-4847e2d3e8a3'),
  desert: u('1721833963573-0bf0454d6a97'),
  cliffs: u('1757392294232-274ea574dc17'),
  waterfall: u('1512005654819-3e01846b1a16'),
  aurora: u('1682547095505-aefe40454fac', 1600),
  stream: u('1475092432448-fe76c45a8d6d'),
  flower: '/flower.jpg',
}
