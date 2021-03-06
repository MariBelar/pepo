exports.getCheckUniqueness = function (req, res) {
    if (!req.query.username) {
        return res
            .status(400)
            .json({ error: 'You MUST pass "username" param in query params' });
    }

    var app = req.app;
    var handleError = app.get('helpers').handleError;
    var User = app.get('db').model('User');

    User
        .findOne({ username: req.query.username })
        .then(function (data) {
            res.json({ available: data === null });
        })
        .catch(function (err) {
            handleError(req, res, err);
        });
};

var ONLY_ALLOWED_SYMBOLS = /[^a-zA-Z0-9]/g;

exports.getLoadList = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var bem = helpers.bem;
    var User = app.get('db').model('User');
    var sessionUser = req.user;

    var query = {
        username: {
            $exists: true,
            $ne: sessionUser.username
        }
    };
    var search = req.query.search;

    if (search) {
        search = search.replace(ONLY_ALLOWED_SYMBOLS, '');

        if (!search.length) {
            return res.json({ docs: [], limit: 0, offset: 0, total: 0 });
        }

        query.username.$regex = new RegExp(search, 'i');
    }

    helpers
        .checkPaginationParams(req, res, app.get('conf').db.limits.users)
        .then(function (pagination) {
            User
                .paginate(query, {
                    offset: pagination.offset,
                    limit: pagination.limit,
                    sort: { subscribersCount: -1 }
                })
                .then(function (result) {
                    if (!req.query.hasOwnProperty('html')) {
                        return res.json(result);
                    }

                    res.json({
                        total: result.total,
                        count: result.docs.length,
                        limit: result.limit,
                        offset: result.offset,
                        html: result.docs.map(function (user) {
                            return bem.applyHtml(bem.applyTree([
                                {
                                    block: 'user',
                                    mix: { block: 'infinite-list', elem: 'item' },
                                    user: user,
                                    isYou: user._id.equals(sessionUser._id),
                                    subscribed: sessionUser.subscribedTo.indexOf(user._id.toString()) !== -1
                                }
                            ]));
                        }).join('')
                    });
                })
                .catch(function (err) {
                    handleError(req, res, err);
                });
        });
};

exports.getSubscribers = getRelatedUsers('subscribers');
exports.getSubscriptions = getRelatedUsers('subscribedTo');


exports.getLoadOne = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var User = app.get('db').model('User');

    User
        .findOne({ _id: req.params.id })
        .populate(['subscribers'])
        .then(function (user) {
            if (user === null) {
                return res.sendStatus(404);
            }

            return res.json(user);
        })
        .catch(function (err) {
            handleError(req, res, err);
        });
};

exports.putUpdate = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var User = app.get('db').model('User');

    User
        .findById(req.user._id)
        .then(function (doc) {
            if (!doc) {
                return res.sendStatus(404);
            }

            Object.keys(req.body).forEach(function (key) {
                doc[key] = req.body[key];
            });

            return doc.save();
        })
        .then(function (doc) {
            req.login(doc, function (err) {
                if (err) {
                    return handleError(req, res, err);
                }

                res.json(doc);
            });
        })
        .catch(function (err) {
            handleError(req, res, err);
        });
};

exports.postSubscribe = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var User = app.get('db').model('User');
    var currentUserId = req.user._id;
    var subscribeToUserId = req.params.id;
    var resultSubscribeState;

    User
        .findById(req.user._id, { subscribedTo: 1 })
        .then(function (user) {
            var alreadySubscribed = user.subscribedTo.indexOf(subscribeToUserId) !== -1;
            var subscribingUserQuery = {};
            var currentUserQuery = {};

            if (alreadySubscribed) {
                subscribingUserQuery.$pull = { subscribers: currentUserId };
                subscribingUserQuery.$inc = { subscribersCount: -1 };

                currentUserQuery.$pull = { subscribedTo: subscribeToUserId };
                resultSubscribeState = false;
            } else {
                subscribingUserQuery.$push = { subscribers: currentUserId };
                subscribingUserQuery.$inc = { subscribersCount: 1 };

                currentUserQuery.$push = { subscribedTo: subscribeToUserId };
                resultSubscribeState = true;
            }

            var subscribingUserUpdate = User
                .findOneAndUpdate({ _id: subscribeToUserId }, subscribingUserQuery, { runValidators: true });
            var currentUserUpdate = User
                .findOneAndUpdate({ _id: currentUserId }, currentUserQuery, { new: true, runValidators: true });

            return Promise.all([subscribingUserUpdate, currentUserUpdate]);
        })
        .then(function (results) {
            req.login(results[1], function (err) {
                if (err) {
                    return handleError(req, res, err);
                }

                res.json({ subscribed: resultSubscribeState });
            });
        })
        .catch(function (err) {
            handleError(req, res, err);
        });
};

function getRelatedUsers(usersField) {
    return function (req, res) {
        var app = req.app;
        var helpers = app.get('helpers');
        var handleError = helpers.handleError;
        var bem = helpers.bem;
        var User = app.get('db').model('User');
        var sessionUser = req.user;

        helpers
            .checkPaginationParams(req, res, app.get('conf').db.limits.users)
            .then(function (pagination) {
                return User
                    .findOne({ _id: req.params.id })
                    .then(function (user) {
                        if (user === null) {
                            return Promise.reject(404);
                        }

                        return { pagination: pagination, user: user };
                    });
            })
            .then(function (data) {
                var pagination = data.pagination;
                var offset = pagination.offset;
                var limit = pagination.limit;
                var user = data.user;
                var usersList = user[usersField];
                var paginatedUsers = usersList.slice(offset, offset + limit);

                return User
                    .find({ _id: { $in: paginatedUsers }})
                    .sort({ subscribersCount: -1 })
                    .then(function (results) {
                        return {
                            total: usersList.length,
                            docs: results,
                            offset: offset,
                            limit: limit
                        };
                    });
            })
            .then(function (result) {
                if (!req.query.hasOwnProperty('html')) {
                    return res.json(result);
                }

                res.json({
                    total: result.total,
                    count: result.docs.length,
                    limit: result.limit,
                    offset: result.offset,
                    html: result.docs.map(function (user) {
                        return bem.applyHtml(bem.applyTree([
                            {
                                block: 'user',
                                mix: { block: 'infinite-list', elem: 'item' },
                                user: user,
                                isYou: user._id.equals(sessionUser._id),
                                subscribed: sessionUser.subscribedTo.indexOf(user._id.toString()) !== -1
                            }
                        ]));
                    }).join('')
                });
            })
            .catch(function (err) {
                handleError(req, res, err);
            });
    };
}
