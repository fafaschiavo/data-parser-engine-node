#!/usr/bin/env node
var express = require('express');
var puppeteer = require('puppeteer');
const proxyChain = require('proxy-chain');
var cors = require('cors');
var app = express();
const html_parser = require('node-html-parser');
const cheerio = require('cheerio');
const UserAgent = require('user-agents');
const puppeteerExtra = require('puppeteer-extra');
const pluginStealth = require('puppeteer-extra-plugin-stealth');
var uniqid = require('uniqid');

// Import our models
const { selector_set } = require(__dirname + '/models.js');

// Allow for global cross origin requests on all routes
app.use(cors())

// Helper function to scroll the page all teh way down before parsing
async function autoScroll(page){
	await page.evaluate(async () => {
		await new Promise((resolve, reject) => {
			var totalHeight = 0;
			var distance = 100;
			var timer = setInterval(() => {
				var scrollHeight = document.body.scrollHeight;
				window.scrollBy(0, distance);
				totalHeight += distance;

				if(totalHeight >= scrollHeight){
					clearInterval(timer);
					resolve();
				}
			}, 100);
		});
	});
}

// Helper function to permorm a simple delay
function delay(time) {
	return new Promise(function(resolve) { 
		setTimeout(resolve, time)
	});
}

// GET Page
async function request_page(url, selector_array, use_proxy, scroll_page, wait_for_async_loading){
	use_proxy = use_proxy == null ? false : use_proxy

	if (use_proxy) {	
		const proxy_url = await proxyChain.anonymizeProxy('http://lum-customer-hl_73fbaaa8-zone-static:xx8t0lz5raap@zproxy.lum-superproxy.io:22225');

		console.log('Now opening stealh browser with proxy and...');
		puppeteerExtra.use(pluginStealth());

		var browser = await puppeteerExtra.launch({
			// headless: false,
			args: [
				'--no-sandbox',
				'--disable-setuid-sandbox',
				'--proxy-server=' + proxy_url,
				'--window-size=1920,1080'
			]
		});
	}else{
		console.log('Now opening stealh browser...');
		puppeteerExtra.use(pluginStealth());

		var browser = await puppeteerExtra.launch({
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

	// Generate random user agent
	var user_agent = new UserAgent();
	user_agent = user_agent.toString();
	page.setUserAgent(user_agent);

	// Clear default settings (important to apply custom window size)
	await page._client.send('Emulation.clearDeviceMetricsOverride');

	console.log('Now requesting page: ' + url);
	var response = await page.goto(url, {waitUntil: 'load', timeout: 0});

	if (scroll_page) {
		console.log('Now scrolling all the way down...');
		await autoScroll(page);
	}

	if (wait_for_async_loading) {
		console.log('Now waiting for async loading...');
		await delay(5000);
	}

	console.log('Now preparing data...');
	var page_source = await response.text();
	
	console.log('Now taking screenshot...');
	await page.screenshot({path: 'example.png'});

	console.log('Now cherry picking the elements of interest...');
	// matches[url_id][selector_id] = {data_type: 'json', text: JSON.stringify(text), html: JSON.stringify(outerHTML)}

	var matches = {}
	var selector_ids = Object.keys(selector_array);
	for (var i = selector_ids.length - 1; i >= 0; i--) {
		var selector_id = selector_ids[i];
		var selector = selector_array[selector_id];
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
	var selector_array = req.query.selectors;

	// Since boolean variabled are turned into string when passed via GET paramenters, let's get them back to booleans
	settings.use_proxy = (settings.use_proxy == 'true')
	settings.wait_for_async_loading = (settings.wait_for_async_loading == 'true')
	settings.scroll_page = (settings.scroll_page == 'true')

	// Request the page
	request_page(url, selector_array, settings.use_proxy, settings.scroll_page, settings.wait_for_async_loading)
	.then((puppeteer_response) =>{
			res.json(puppeteer_response)
		}
	)
});


// Save a Selector Set.
app.get('/save-selector-set/', function(req, res, next) {

	var selectors = req.query.selector_set;
	var set_name = req.query.set_name;

	var new_selector_set_hash_id = uniqid()

	selector_set.create({
			set_name: set_name,
			selectors_json: JSON.stringify(selectors),
			hash_id: new_selector_set_hash_id
		}).then(new_set => {
			let response = {status: 'success', hash_id: new_selector_set_hash_id}
			res.json(response)
		}
	);
});


// Delete a Selector Set.
app.get('/delete-selector-set/', function(req, res, next) {

	var selector_set_hash_id = req.query.hash_id;

	selector_set.destroy({
		where: {
			hash_id: selector_set_hash_id
		}
	}).then(() => {
		res.json({ status: 'success', hash_id: selector_set_hash_id })
	});

});


// GET Selector Sets.
app.get('/selector-sets/', function(req, res, next) {
	selector_set.findAll().then(selector_sets => {
		let response = {status: 'success', selector_sets: selector_sets}
		res.json(response)
	});

});


// // Test
// app.listen(5000, function () {
//   console.log('Data parser app listening on port 5000!');
// });

// Live
app.listen(8000, function () {
  console.log('Data parser app listening on port 8000!');
});










