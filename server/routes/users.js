var Router = require('express').Router;
var usersController = require('../controllers/users.controllers');

module.exports = function (app) {
    var usersRoutes = new Router();
    var onlyAjax = app.get('middlewares').onlyAjax;

    usersRoutes
        .get('/check-uniqueness', onlyAjax, usersController.getCheckUniqueness)
        .put('/:id', onlyAjax, usersController.putUpdate);

    return usersRoutes;
};
