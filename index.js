const readline = require('readline-sync')
const puppeteer = require('puppeteer')
const delay = require('delay')
const fs = require('fs')
const path = require('path')
const moment = require('moment')
const { Spinner } = require('cli-spinner');

const spinner = new Spinner('processing.. %s')

const main = (async () => {
  const runId = moment().format('YYYYMMDD HH-mm-ss')
  const login = readline.question('Facebook login: ')

  const outputsDir = path.join(__dirname, 'outputs')
  if (!fs.existsSync(outputsDir)){
    fs.mkdirSync(outputsDir);
  }

  const userDir = path.join(__dirname, 'outputs', login.split('@')[0])
  const sessionDir = path.join(userDir, runId)

  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setViewport({ width: 1400, height: 900 })

  try {
    const readCookiesRaw = fs.readFileSync(path.join(userDir, 'config.json'))
    const cookies = JSON.parse(readCookiesRaw)
    cookies.forEach(async c => {
      await page.setCookie(c)
    })
    spinner.start()
    await page.goto('https://facebook.com');
    await page.waitForSelector('#findFriendsNav')
    spinner.stop()
  } catch (e) {
    spinner.stop()
    let notLoggedIn = true
    let retries = 3
    let passwordQuestion = 'Seems like there is no actual access config, please provide password from fb acc: '
    do {
      spinner.stop()
      try {
        const password = readline.question(passwordQuestion, {
          hideEchoBack: true,
        })
        spinner.start()
        await page.goto('https://facebook.com');
        await page.type('#email', login)
        await page.type('#pass', password)
        await page.click('#loginbutton')
        await page.waitForSelector('#findFriendsNav')
        notLoggedIn = false
      } catch (e) {
        console.log('Error during login (check credentials)', e)
        passwordQuestion = `Password seems to be incorrect. Check it and type down (${retries} retries left): `
      }
      retries--
    } while (notLoggedIn && retries)

    if (!fs.existsSync(userDir)){
      fs.mkdirSync(userDir);
    }

    const cookies = await page.cookies()
    fs.writeFileSync(path.join(userDir, 'config.json'), JSON.stringify(cookies))
  }

  spinner.start()
  await page.click('#findFriendsNav')

  if (!fs.existsSync(sessionDir)){
    fs.mkdirSync(sessionDir);
  }

  try {
    for (let i = 1; i <= 5; i++) {
      await page.waitForSelector('.friendBrowserForm')
      await page.click(`li.friendBrowserListUnit:nth-of-type(${i}) > div > a`)
      await page.waitForSelector('.userContentWrapper a')
      await page.screenshot({path: path.join(sessionDir, `user-${i}.png`), fullPage: false});
      await page.goBack()
    }
  } catch(e) {
    console.log('Error occurred', e)
    await page.screenshot({path: path.join(sessionDir, 'error.png'), fullPage: false});
  }

  spinner.stop()

  await browser.close();

  console.log('\nDone!')
  process.exit()
})

main()
