#!/usr/bin/env node

var program = require('commander');
var faker = require('faker');
var _ = require('lodash');
var db = require('./common');
var xss = require('xss');
var postEntity = require('post-entity');
var postEntityTypes = require('../../isomorphic/post-entity-types');

program
    .option('-d, --database [n]', 'database name')
    .option('-u, --users <n>', 'users count', parseInt)
    .option('-m, --messages <n>', 'messages count', parseInt)
    .parse(process.argv);

if (!_.isNumber(program.users) || !_.isNumber(program.messages)) {
    console.error('-u, --users AND -m, --messages params is mandatory, and it must be integer values'); // eslint-disable-line no-console, max-len
    process.exit(1); // eslint-disable-line no-process-exit
}


db.connect(program.database, function (err, mongoose) {
    if (err) {
        console.error('error on db connection', err.stack); // eslint-disable-line no-console
        process.exit(1); // eslint-disable-line no-process-exit
    }

    var startDate = new Date();
    console.log('Generation started: ' + startDate.toISOString()); // eslint-disable-line no-console

    var User = mongoose.model('User');
    var Message = mongoose.model('Message');

    var users = [];
    var messages = [];

    for (var i = 0; i < program.users; i++) {
        users.push(generateUserData(users));
    }
    process.on('SIGINT', db.disconnect);

    User.collection.insert(users)
        .then(function (data) {
            console.log('Users successfully inserted. Count: %d', data.result.n); // eslint-disable-line no-console
            return data.ops;
        })
        .then(function (insertedUsers) {
            var maxSubscribersCount = Math.floor(Math.sqrt(program.users));

            insertedUsers.forEach(function (user) {
                var randomUser;

                for (var j = 0; j < maxSubscribersCount; j++) {
                    if (Math.random() < 0.4) {
                        continue;
                    }

                    randomUser = getRandomItem(insertedUsers);

                    if (user !== randomUser) {
                        randomUser.subscribedTo.push(user._id);
                        user.subscribers.push(randomUser._id);
                        user.subscribersCount += 1;
                    }
                }
            });

            return transactionUpdate(insertedUsers, function (user) {
                return User.findByIdAndUpdate(user._id, _.omit(user, ['_id']), { new: true });
            });
        })
        .then(function (updatedUsers) {
            users = updatedUsers;

            users.forEach(function (user) {
                for (var j = 0; j < program.messages; j++) {
                    messages.push(generateMessageData(user._id));
                }
            });

            return Message.collection.insert(messages);
        })
        .then(function (data) {
            console.log('Messages successfully inserted. Count: %d', data.result.n); // eslint-disable-line no-console
            return data.ops;
        })
        .then(function (insertedMessages) {
            var repliesCount = Math.ceil(Math.sqrt(program.messages) / 3);

            insertedMessages.forEach(function (message) {
                var randomMessage;
                var otherUsersMessages = insertedMessages.filter(function (m) {
                    return m.user !== message.user;
                });

                for (var j = 0; j < repliesCount; j++) {
                    randomMessage = getRandomItem(otherUsersMessages);

                    message.replies.push(randomMessage._id);
                    randomMessage.parent = message._id;
                }
            });

            return transactionUpdate(insertedMessages, function (message) {
                return Message.findByIdAndUpdate(message._id, _.omit(message, ['_id']), { new: true });
            });
        })
        .then(function () {
            var endDate = new Date();

            console.log('Generation completed: ' + endDate.toISOString()); // eslint-disable-line no-console
            console.log('Generation time: ' + (endDate.getTime() - startDate.getTime()) / 1000 + ' s'); // eslint-disable-line no-console, max-len
            console.log('All work successfully done. Bye!'); // eslint-disable-line no-console
            db.disconnect();
            process.exit(0); // eslint-disable-line no-process-exit
        })
        .catch(function (usersInsertErr) {
            console.error('Error on creating users: ', usersInsertErr.stack); // eslint-disable-line no-console
            process.exit(1); // eslint-disable-line no-process-exit
        });
});

function getUniqueUsername(allUsers) {
    var username;

    do {
        username = (faker.internet.userName() + Math.random().toString(36).substr(0, 8)).replace(/[^\da-zA-Z]/g, '');
    } while (_.find(allUsers, { username: username }));

    return username;
}

function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function transactionUpdate(dataArray, promiseFn) {
    var transaction = Promise.resolve();
    var results = [];

    dataArray.forEach(function (item) {
        transaction = transaction.then(function () {
            return promiseFn(item).then(function (data) {
                results.push(data);
            });
        });
    });

    return transaction.then(function () {
        return results;
    });
}

function generateUserData(allUsers) {
    return {
        username: getUniqueUsername(allUsers),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
        description: faker.lorem.paragraph(),
        avatar: faker.image.avatar(),
        provider: ['facebook', 'vkontakte', 'yandex', 'google'][Math.floor(Math.random() * 4)],
        subscribedTo: [],
        subscribers: [],
        subscribersCount: 0,
        facebook: {
            id: faker.random.number()
        }
    };
}

function generateMessageData(userId) {
    var geo = null;
    var image = null;
    var text = postEntity
        .process(faker.lorem.sentence(), postEntityTypes)
        .map(function (entity) {
            return Object.assign({}, entity, { raw: xss(entity.raw) });
        })
        .filter(function (entity) {
            return entity.raw !== '';
        });
    var random = Math.random();

    if (random < 0.3) {
        geo = {
            latitude: faker.address.latitude(),
            longitude: faker.address.longitude()
        };
    } else if (random > 0.7) {
        image = faker.image.imageUrl();
    }

    return {
        user: userId,
        parent: null,
        text: text,
        replies: [],
        image: image,
        geo: geo
    };
}
