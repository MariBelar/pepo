exports.postCreate = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var Message = app.get('db').model('Message');

    var message = new Message(Object.assign({}, req.body, { user: req.user._id }));

    message
        .save()
        .then(function (data) {
            res.json(data);
        })
        .catch(function (err) {
            handleError(req, res, err);
        });
};

exports.getLoadList = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var mongoose = app.get('db');
    var Message = mongoose.model('Message');
    var userId = req.query.userId;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res
            .status(400)
            .json({ error: 'You MUST pass "userId" param in query params' });
    }


    helpers
        .checkPaginationParams(req, res, app.get('conf').db.limits.messages)
        .then(function (pagination) {
            Message
                .paginate(
                    { user: userId },
                    {
                        populate: 'replies user',
                        offset: pagination.offset,
                        limit: pagination.limit,
                        sort: '-createdAt'
                    }
                )
                .then(function (result) {
                    res.json(result);
                })
                .catch(function (err) {
                    handleError(req, res, err);
                })
        });


};

exports.getLoadOne = function (req, res) {
    var app = req.app;
    var helpers = app.get('helpers');
    var handleError = helpers.handleError;
    var Message = app.get('db').model('Message');

    helpers
        .isValidEntityId(req, res)
        .then(function () {
            Message
                .findOne({ _id: req.params.id })
                .populate('replies user')
                .then(function (message) {
                    if (message === null) {
                        return res.sendStatus(404);
                    }

                    return res.json(message);
                })
                .catch(function (err) {
                    handleError(req, res, err);
                });
        });
};