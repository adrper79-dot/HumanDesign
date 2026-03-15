(function () {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Pricing — Prime Self',
    description: 'Simple, transparent pricing for Prime Self Energy Blueprint and AI profiles.',
    url: 'https://selfprime.net/pricing',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: [
        {
          '@type': 'Product',
          name: 'Prime Self Free',
          description: 'Unlimited chart calculations, 1 AI synthesis per month, daily transit brief, check-ins and diary.',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }
        },
        {
          '@type': 'Product',
          name: 'Prime Self Individual',
          description: '10 AI profile generations per month, unlimited AI questions, full transit tools, SMS energy digests, PDF export.',
          offers: { '@type': 'Offer', price: '19', priceCurrency: 'USD', billingIncrement: 'Monthly' }
        },
        {
          '@type': 'Product',
          name: 'Prime Self Practitioner',
          description: '500 AI syntheses per month, full client management, session prep AI, branded PDF reports, public practitioner profile.',
          offers: { '@type': 'Offer', price: '97', priceCurrency: 'USD', billingIncrement: 'Monthly' }
        },
        {
          '@type': 'Product',
          name: 'Prime Self Agency',
          description: 'Up to 5 practitioner seats, 2000 AI syntheses per month, white-label portal, API access, custom webhooks.',
          offers: { '@type': 'Offer', price: '349', priceCurrency: 'USD', billingIncrement: 'Monthly' }
        }
      ]
    }
  };

  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.text = JSON.stringify(schema);
  document.head.appendChild(script);
})();