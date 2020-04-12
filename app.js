#!/usr/bin/env node
var express = require('express');
var puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
var cors = require('cors');
var app = express();

const html_parser = require('node-html-parser');
const cheerio = require('cheerio')

// Allow for global cross origin requests on all routes
app.use(cors())

// GET Page
async function request_page(url, use_proxy, selectors){
	use_proxy = use_proxy == null ? false : use_proxy

	if (use_proxy) {	
		const proxy_url = await proxyChain.anonymizeProxy('http://lum-customer-hl_73fbaaa8-zone-static:xx8t0lz5raap@zproxy.lum-superproxy.io:22225');

		console.log('Now opening browser with proxy...');
		var browser = await puppeteer.launch({
			// headless: false,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--proxy-server=' + proxy_url,
				'--window-size=1920,1080'
			]
		});
	}else{
		console.log('Now opening browser...');
		var browser = await puppeteer.launch({
			// headless: false,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--window-size=1920,1080',
			]
		});
		// var browser = await puppeteer.launch({defaultViewport: null});
	}
	
	var page = await browser.newPage();

	// Clear default settings (important to apply custom window size)
	await page._client.send('Emulation.clearDeviceMetricsOverride');

	console.log('Now requesting page: ' + url);
	var response = await page.goto(url, {waitUntil: 'load', timeout: 0});

	console.log('Now preparing data...');
	var page_source = await response.text();
	
	console.log('Now taking screenshot...');
	await page.screenshot({path: 'example.png'});

	console.log('Now cherry picking the elements of interest...');
	// matches[url_id][selector_id] = {data_type: 'json', text: JSON.stringify(text), html: JSON.stringify(outerHTML)}

	var matches = {}
	var selector_ids = Object.keys(selectors);
	for (var i = selector_ids.length - 1; i >= 0; i--) {
		var selector_id = selector_ids[i];
		var selector = selectors[selector_id];
		var css_selector = selector.css_selector;
		var attr = selector.attr;

		// Evaluate the page looking for matches - only if the attribute requested is the inner text
		if (attr == 'innerText') {
			results = await page.evaluate((css_selector, attr) => {
				// The code inside this curly brackets will run in the browser, not here
				var matches_in_page = []

				document.querySelectorAll(css_selector).forEach(match => matches_in_page.push(
					{
						text: match.textContent,
						html: match.innerHTML,
					}
				))

				return matches_in_page
			}, css_selector, attr)

		// Evaluate the page looking for matches - only if the attribute requested is NOT the inner text
		}else{
			results = await page.evaluate((css_selector, attr) => {
				// The code inside this curly brackets will run in the browser, not here
				var matches_in_page = []

				document.querySelectorAll(css_selector).forEach(match => matches_in_page.push(
					{
						text: match.getAttribute(attr),
						html: match.innerHTML,
					}
				))

				return matches_in_page
			}, css_selector, attr)
		}

		// And finally we assign the matches to the right selector ID
		matches[selector_id] = results;
	}

	await browser.close();
	
	console.log("I'm done here!");
	
	return {
		status: 'success',
		response_code: response._status,
		page_source: page_source,
		matches: matches
	}
}


// GET home page.
app.get('/', function(req, res, next) {
	res.send('Hello From Express!');
});


// GET scrape.
app.get('/scrape/', function(req, res, next) {	
	var url = req.query.url;
	var settings = req.query.settings;
	var selectors = req.query.selectors;

	// Since boolean variabled are turned into string when passed via GET paramenters, let's get them back to booleans
	settings.use_proxy = (settings.use_proxy == 'true')

	// Request the page
	request_page(url, settings.use_proxy, selectors)
	.then((puppeteer_response) =>{
			res.json(puppeteer_response)
		}
	)
});


app.listen(8000, function () {
  console.log('Data parser app listening on port 8000!');
});






// tags = await page.evaluate(() => {
// 	const links = []
// 	document.querySelectorAll('.lot-container .box-link').forEach(link => links.push(link.getAttribute('href')))
// 	return links
// })
// console.log('------------------')
// console.log(tags)
// console.log('------------------')



// tags = await page.$$eval('.lot-container .box-link', links =>
// 	links.map(link => link.getAttribute('href'))
// )
// console.log('------------------')
// console.log(tags)
// console.log('------------------')










