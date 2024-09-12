const { scrapeUrl } = require("./utils/scraper");

const userInput = process.argv[2];
const userInputUrl = new URL(userInput);
const userInputHost = userInputUrl.host.startsWith("www.")
  ? userInputUrl.host.slice(4)
  : userInput.host;

const scrapeAdapter = {
  "vinted.de": {
    url: "",
    title: ".web_ui__Image__content",
  },
};

if (!scrapeAdapter[userInputHost]) {
  throw new Error("Invalid URL.");
}

console.log(scrapeAdapter[userInputHost]);

scrapeUrl({ ...scrapeAdapter[userInputHost], url: userInput });
