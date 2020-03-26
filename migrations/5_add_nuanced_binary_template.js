module.exports = function(deployer) {
  deployer.then(async () => {
    const realitio = await artifacts.require('Realitio').deployed();
    if ((await realitio.templates(5)).eqn(0))
      await realitio.createTemplate('{"title":"%s","type":"single-select","outcomes":["No","Mostly No","Undecided","Mostly Yes","Yes"],"category":"%s","lang":"%s"}');
  });
};
