import { Redirect } from "../classes/Redirect.mjs";
import { Router } from "../classes/Router.mjs";
import { View } from "../classes/View.mjs";

Router.init();
Router.get("/", (res) => {
  return new View("index", {
    title: "Instagram Photos downloader",
    showButton: true,
  });
});

Router.get('/home', (res) => {
  return new View('index', {
      title: 'Redirected',
      showButton: false,
  })
})

Router.post("/fetch-instagram-token", (res) => {
  return new Redirect("/home");
});
