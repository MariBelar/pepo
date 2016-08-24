var Router = require('express').Router;
var authRoutes = require('./auth');
var userRoutes = require('./users');
var messageRoutes = require('./messages');
var mainController = require('../controllers/main.controller');

module.exports = function (app) {
    var rootRoutes = new Router();
    var isAuth = app.get('middlewares').isAuth;
    var conf = app.get('conf');

    rootRoutes
        .use('/api/auth', authRoutes(app))
        .use('/api/users', isAuth, userRoutes(app))
        .use('/api/messages', isAuth, messageRoutes(app))
        .get('/', isAuth, mainController.getIndex)
        .get(conf.auth.loginPageRedirect, isAuth, mainController.getLogin)
        .get(conf.auth.selectUsernameRedirect, isAuth, mainController.getSelectUsername)
        .use(mainController.get404);

    return rootRoutes;
};

