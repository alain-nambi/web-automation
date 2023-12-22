const { test, expect } = require('@playwright/test');

test('Send PNR and Receipt to GPNR Application', async ({ page }) => {
  console.time("Performance");

  // Navigate the page to a URL
  await page.goto('https://emea.ttinteractive.com/otds/index.asp');

  // Type into the login form
  await page.type('#login', 'TAHINA');
  await page.type('#pwd', 'TAHINA02');
  await page.type('#LoginCompanyIdentificationCode', 'EWAIR');
  await page.click('#signInButton');

  // Wait for the #Search input to be available
  const searchInputSelector = '#Search';
  await page.waitForSelector(searchInputSelector);

  // Type into the search box
  await page.type(searchInputSelector, '00D32J');

  // Press Enter
  await page.keyboard.press('Enter');

  // Localize iframe
  const mainFrame = await page.frameLocator('#mainFrame');

  // Click the button inside the iframe
  await mainFrame.locator('.ActionsListButtons > #instanceCtrlContent_btConfirmationParMail').click();

  // Get a list of client emails
  const listOfClientMails = await mainFrame.locator('#instanceCtrlContent_ctrlEnteteSyntheseDossier_hlEmailClient').allTextContents();
  const ArrayFromListOfClientMails = Array.from(listOfClientMails);

  // Clear the text area for sending confirmation emissions
  const textAreaSendConfirmationEmissions = await mainFrame.locator('#instanceCtrlContent_ctrlEnvoiEmail_txtEmailDestinataire');
  const textInTextarea = await textAreaSendConfirmationEmissions.inputValue();
  const ArrayFromTextInTextarea = await textInTextarea.split(",");

  // Batch assertion
  ArrayFromListOfClientMails.forEach((clientEmail, clientEmailIndex) => {
    expect(clientEmail).toBe(ArrayFromTextInTextarea[clientEmailIndex]);
  });

  await textAreaSendConfirmationEmissions.clear()

  console.timeEnd("Performance");
});
