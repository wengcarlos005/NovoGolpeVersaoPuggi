/// <reference types="vite/client" />

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.svg" {
  const content: string;
  export default content;
}

declare module "*.mp3" {
  const content: string;
  export default content;
}
