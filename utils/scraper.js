const puppeteer = require("puppeteer");

const scrapeUrl = async (url) => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle2" });

  const data = await page.evaluate(() => {
    const title =
      document.querySelector("YOUR_TITLE_SELECTOR")?.innerText || "";
    const price =
      document.querySelector("YOUR_PRICE_SELECTOR")?.innerText || "";
    const imageUrl = document.querySelector("YOUR_IMAGE_SELECTOR")?.src || "";
    return { title, price, imageUrl };
  });

  await browser.close();
  return data;
};

module.exports = { scrapeUrl };
