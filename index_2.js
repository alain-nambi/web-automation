const express = require('express');
const { chromium, expect } = require('@playwright/test');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = 3000;

app.post('/sendPNRAndReceipt', async (req, res) => {
    const { pnrNumber } = req.body;

    async function launchBrowser() {
        return chromium.launch({ headless: false });
    }

    async function login(page) {
        await page.goto('https://emea.ttinteractive.com/otds/index.asp');
        await page.type('#login', 'TAHINA');
        await page.type('#pwd', 'TAHINA02');
        await page.type('#LoginCompanyIdentificationCode', 'EWAIR');
        await page.click('#signInButton');
    }

    async function searchAndSendEmail(page) {
        const searchInputSelector = '#Search';
        await page.waitForSelector(searchInputSelector);
        await page.type(searchInputSelector, pnrNumber);
        await page.keyboard.press('Enter');

        const mainFrame = await page.frameLocator('#mainFrame');
        const pnrStatusElement = await mainFrame.locator('.PNRDisplayReference > #instanceCtrlContent_ctrlEnteteSyntheseDossier_lblEtatDossier');
        const pnrStatusText = await pnrStatusElement.innerText();

        if (String(pnrStatusText) === 'Annulé') {
            return 'cancelled';
        } else {
            console.log('PNR non annulé');
            await mainFrame.locator('.ActionsListButtons > #instanceCtrlContent_btConfirmationParMail').click();

            const listOfClientMails = await mainFrame.locator('#instanceCtrlContent_ctrlEnteteSyntheseDossier_hlEmailClient').allTextContents();
            // const ArrayFromListOfClientMails = Array.from(listOfClientMails);

            const textAreaSendConfirmationEmissions = await mainFrame.locator('#instanceCtrlContent_ctrlEnvoiEmail_txtEmailDestinataire');
            // const textInTextarea = await textAreaSendConfirmationEmissions.inputValue();
            // const ArrayFromTextInTextarea = await textInTextarea.split(",");

            // ArrayFromListOfClientMails.forEach((clientEmail, clientEmailIndex) => {
            //     expect(clientEmail).toBe(ArrayFromTextInTextarea[clientEmailIndex]);
            // });

            await textAreaSendConfirmationEmissions.clear();

            return 'available'
        }
    }

    async function trySendEmail() {
        const browser = await launchBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            await login(page);
            const result = await searchAndSendEmail(page);
            console.log(result);

            if (result === 'cancelled') {
                return res.status(301).json({ status: 'Cancelled', pnrNumber: pnrNumber });
            } else {
                return res.status(200).json({ status: 'Success', pnrNumber: pnrNumber });
            }
            // console.log('Email sent successfully!');
        } catch (error) {
            console.error(`Failed to send email: ${error.message}`);
        } finally {
            // await browser.close();
        }
    }

    console.time('Performance');
    try {
        await trySendEmail();
        // return res.status(200).json({ status: 'Success' });
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
    console.timeEnd('Performance');
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
