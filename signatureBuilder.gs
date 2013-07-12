function doGet(request) {
  request = request || {parameter: {fn: null}};
  var content, user = Session.getActiveUser(), data, json, importData, mode;
  mode = request.parameter.fn;
  content = mode;
  try {
    switch (mode) {
      case 'Start Over':
        ScriptProperties.deleteProperty(user.getEmail());
      case 'Build Signature':
        if (mode === 'Build Signature') {
          importData = request.parameter;
          importData.addresses = request.parameters.address;
          Utilities.jsonStringify(request.parameters);
          data = {
            name: (function() { var u = UserManager.getUser(Session.getActiveUser()); return [u.getGivenName(), u.getFamilyName()].join(' ');})(),
            title: importData.title,
            pa: importData.pa,
            addresses: (importData.addresses || []).map(function(address) { return getAddress(address); }),
            company: importData.company,
            delegators: importData.delegators,
            directline: importData.directline,
            mobile: importData.mobile,
            build: true,
            send: false,
            sent: false
          }
          json = Utilities.jsonStringify(data);
          ScriptProperties.setProperty(user.getEmail(), json);
        }
      default:    
        data = ScriptProperties.getProperty(user.getEmail());
        if (data) {        
          page = HtmlService.createTemplateFromFile('view-signature.html');
          page.data = Utilities.jsonParse(data);
          page.data.url = ScriptApp.getService().getUrl();
          page.data.send = false;
          page.data.sent = false;
          if (mode !== 'Build Signature') {
            page.data.build = false;
          }        
          if (mode === 'Set Signature') {
            page.data.send = true;
            sendSignature(user.getEmail(), page.evaluate().getContent());
            
            page.data.send = false;
            page.data.sent = true;
          }
          content = page.evaluate().getContent(); 
          data = page.data;        
          json = Utilities.jsonStringify(data);
          ScriptProperties.setProperty(user.getEmail(), json);
        } else {
          page = HtmlService.createTemplateFromFile('build-signature.html');
          page.data = {
            url: ScriptApp.getService().getUrl(),
            name: (function() { var u = UserManager.getUser(Session.getActiveUser()); return [u.getGivenName(), u.getFamilyName()].join(' ');})(),
            norecord: true
          };
          content = page.evaluate().getContent();
        }
    }
  } catch (err) {
    Logger.log(err);
    return ContentService.createTextOutput(JSON.stringify(err)).setMimeType(ContentService.MimeType.JSON);
  }
  return HtmlService.createHtmlOutput().setContent(content).setTitle('AAM Signature Builder');
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename)
  .getContent();
}

function getAddress(address) {
  var addresses = {
    london: 'london.html',
    liverpool: 'amup-liverpool.html',
    doha: 'doha.html'
  }
  return HtmlService.createHtmlOutputFromFile(addresses[address]).getContent();
}

function getPayload(signature) {
  signature = signature.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  signature = signature.replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
  
  var xml = '<?xml version="1.0" encoding="utf-8"?>' +
    '<atom:entry xmlns:atom="http://www.w3.org/2005/Atom" xmlns:apps="http://schemas.google.com/apps/2006" >' +
      '<apps:property name="signature" value="'+signature+'" /></atom:entry>';
  return xml;
}

function sendSignature(email, signature) {
  var requestData = {
    'method': 'PUT',
    'contentType': 'application/atom+xml',
    'payload': getPayload(signature)
  };
  var result = authorisedUrlFetch(email, requestData);
  return result.getResponseCode();
}

function authorisedUrlFetch(email, requestData) {
  var oAuthConfig = UrlFetchApp.addOAuthService('google');
  oAuthConfig.setConsumerSecret(UserProperties.getProperty('oAuthConsumerSecret')); 
  oAuthConfig.setConsumerKey(UserProperties.getProperty('oAuthClientID'));
  oAuthConfig.setRequestTokenUrl('https://www.google.com/accounts/OAuthGetRequestToken?scope=https%3A%2F%2Fapps-apis.google.com%2Fa%2Ffeeds%2Femailsettings%2F');
  oAuthConfig.setAuthorizationUrl('https://www.google.com/accounts/OAuthAuthorizeToken');
  oAuthConfig.setAccessTokenUrl('https://www.google.com/accounts/OAuthGetAccessToken');
  UrlFetchApp.addOAuthService(oAuthConfig);
  requestData['oAuthServiceName'] = 'google';
  requestData['oAuthUseToken'] = 'always';
  var emailParts = email.split('@');
  var url = 'https://apps-apis.google.com/a/feeds/emailsettings/2.0/' + emailParts[1] + '/' + emailParts[0] + '/signature';
  var result = UrlFetchApp.fetch(url, requestData);
  if ( result.getResponseCode() != 200 ) {
  }
  return result;
}