const puppeteer = require("puppeteer");

const scrapeUrl = async (url) => {
  try {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2" });

    // Wait for the page to finish loading
    await page.waitForFunction(() => {
      return document.readyState === "complete";
    });

    const data = await page.evaluate(() => {
      // Replace these selectors with the actual CSS selectors for the elements you want to scrape
      const title = document.querySelector(".product-title")?.innerText || "";
      const price = document.querySelector(".product-price")?.innerText || "";
      const imageUrl = document.querySelector(".product-image")?.src || "";
      return { title, price, imageUrl };
    });

    await browser.close();
    return data;
  } catch (error) {
    console.error("Error scraping URL:", error);
    throw error;
  }
};

module.exports = { scrapeUrl };
