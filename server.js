require('dotenv').config();

const express = require('express');
const { chromium } = require('@playwright/test');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const port = process.env.PORT || 3002;

// Constantes pour les URL et les informations d'identification
const ENVIRONMENT_TYPE = process.env.ENVIRONMENT_TYPE
const LOGIN_URL = process.env.LOGIN_URL;
const USERNAME_EWA = process.env.USERNAME_EWA;
const PASSWORD_EWA = process.env.PASSWORD_EWA;
const COMPANY_CODE = process.env.COMPANY_CODE;
const EMAIL_RECIPIENT = process.env.EMAIL_RECIPIENT;

// Constantes pour les sélecteurs DOM
const SELECTORS = {
    searchInput: '#Search',
    mainFrame: '#mainFrame',
    pnrStatusElement: '.PNRDisplayReference > #instanceCtrlContent_ctrlEnteteSyntheseDossier_lblEtatDossier',
    listOfClientMails: '#instanceCtrlContent_ctrlEnteteSyntheseDossier_hlEmailClient',
    textAreaSendConfirmationEmissions: '#instanceCtrlContent_ctrlEnvoiEmail_txtEmailDestinataire',
    sendEmailButton: '#instanceCtrlContent_ctrlEnvoiEmail_btEnvoyerEmail',
    confirmationEmailButton: '.ActionsListButtons > #instanceCtrlContent_btConfirmationParMail',
    printPNRReceiptButton: '.ActionsListButtons > #instanceCtrlContent_btImprimer',
    checkBoxPNRReceipt: '#instanceCtrlContent_btEnvoyerMail',
    sendReceiptPnrButton: '#instanceCtrlContent_btEnvoyerMail',
    textAreaSendPNRReceipt: '#instanceCtrlContent_ctrlEnvoiEmail_txtEmailDestinataire',
    checkBoxLabelReceiptDoc: 'Reçu dossier',
};

const PNR_NOT_AVAILABLE = ['Annulé', 'Remboursé']

async function launchBrowser() {
    ENVIRONMENT_TYPE === 'test'
        ? await chromium.launch({ headless: false })
        : await chromium.launch({ headless: true })
}

app.post('/send', async (req, res) => {
    const { pnrNumber, username, password, companyCode } = req.body;

    if (!username || !password) {
        return res.status(401).json({
            message: 'Please enter a username and password'
        })
    }

    if (!companyCode) {
        return res.status(401).json({
            message: 'Please enter a company code'
        })
    }

    if (!pnrNumber) {
        return res.status(400).json({
            message: 'Please enter a PNR number'
        })
    }

    async function login(page) {
        await page.goto(LOGIN_URL);
        await page.type('#login', username);
        await page.type('#pwd', password);
        await page.type('#LoginCompanyIdentificationCode', companyCode);
        await page.click('#signInButton');
    }

    async function sendPnrPDFMail(page) {
        try {
            const searchInput = await page.waitForSelector(SELECTORS.searchInput);
            await searchInput.type(pnrNumber);
            await searchInput.press('Enter');

            const mainFrame = await page.frameLocator(SELECTORS.mainFrame);
            const pnrStatusElement = await mainFrame.locator(SELECTORS.pnrStatusElement);
            const pnrStatusText = await pnrStatusElement.innerText();

            if (PNR_NOT_AVAILABLE.includes(String(pnrStatusText))) {
                return 'cancelled';
            } else {
                await mainFrame.locator(SELECTORS.confirmationEmailButton).click();

                const textAreaSendConfirmationEmissions = await mainFrame.locator(SELECTORS.textAreaSendConfirmationEmissions);
                await textAreaSendConfirmationEmissions.clear()
                await textAreaSendConfirmationEmissions.fill(EMAIL_RECIPIENT);

                await mainFrame.locator(SELECTORS.sendEmailButton).click();

                return 'available';
            }
        } catch (error) {
            return res.status(500).json({
                message: "Error while sending PNR mail",
                error: error.message
            })
        }
    }

    async function sendReceiptPnrMail(page) {
        const mainFrame = await page.frameLocator(SELECTORS.mainFrame);
        await mainFrame.locator(SELECTORS.printPNRReceiptButton).click();

        await mainFrame.getByLabel(SELECTORS.checkBoxLabelReceiptDoc).check()

        await mainFrame.getByRole('button', { name: 'Envoyer email(s)' }).click();
        const textAreaSendReceiptMail = await mainFrame.locator("#instanceCtrlContent_ctrlEnvoiEmail_txtEmailDestinataire")
        textAreaSendReceiptMail.clear()
        textAreaSendReceiptMail.fill(EMAIL_RECIPIENT)

        await mainFrame.locator("#instanceCtrlContent_ctrlEnvoiEmail_btEnvoyerEmail").click()

        return 'available';
    }

    async function trySendEmail() {
        const browser = await launchBrowser();
        const context = await browser.newContext();
        const page = await context.newPage();

        try {
            await login(page);
            const PNRHasBeen = await sendPnrPDFMail(page);

            if (PNRHasBeen === 'cancelled') {
                return res.status(404).json({ status: 'cancelled', pnrNumber });
            } else {
                const ReceiptHasBeen = await sendReceiptPnrMail(page)
                if (PNRHasBeen === 'available') {
                    return res.status(200).json({
                        message: 'PNR has been successfully send',
                        pnrNumber: pnrNumber,
                        email: EMAIL_RECIPIENT
                    });
                }
                if (ReceiptHasBeen === 'available') {
                    return res.status(200).json({
                        message: 'Receipt has been successfully sent',
                        pnrNumber: pnrNumber,
                        email: EMAIL_RECIPIENT
                    })
                }
            }
        } catch (error) {
            return res.status(500).json({ error: `Failed to send email: ${error.message}` });
        } finally {
            await browser.close();
        }
    }

    try {
        await trySendEmail();
    } catch (error) {
        console.log(error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
});

app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});
