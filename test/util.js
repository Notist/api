process.env.NODE_ENV = 'test';

import Group from '../server/models/group';
import User from '../server/models/user';
import Article from '../server/models/article';
import Annotation from '../server/models/annotation';

exports.checkDatabase = function (delayedCallback) {
  // number of milliseconds to allow for the db to update
  const DB_UPDATE_WAIT = 50;
  return new Promise((resolve, reject) => {
    if (typeof delayedCallback !== 'function') {
      reject(new TypeError('Invalid callback to checkDatabase'));
    } else {
      // let callback function resolve the promise after waiting
      setTimeout(() => { delayedCallback(resolve); }, DB_UPDATE_WAIT);
    }
  });
};

exports.addUserWithNGroups = function (nGroups, username = 'user', groupName = 'Group') {
  if (typeof nGroups !== 'number' || nGroups < 0 || typeof username !== 'string' || typeof groupName !== 'string') {
    throw new TypeError('Invalid argument(s)');
  }

  const user = new User({
    googleId: `test_${username}`,
    name: `Test User '${username}'`,
    username,
    email: `${username}@testuri.com`,
  });

  const groups = [];
  for (let i = 0; i < nGroups; i++) {
    groups[i] = new Group({
      name: `${groupName} ${i}`,
      description: `Description of ${groupName} ${i}`,
      creator: user._id,
      members: [user._id],
    });
  }
  user.groups = groups.map(group => {
    return {
      _id: group._id,
      name: group.name,
      isPersonal: group.isPersonal,
    };
  });
  user.save(err => { if (err) throw err; });
  groups.map(group => { group.save(err => { if (err) throw err; }); return 0; });

  return { user, groups };
};

exports.addUserWithGroup = function (username = 'user', groupName = 'Group') {
  const res = exports.addUserWithNGroups(1, username, groupName);
  return { user: res.user, group: res.groups[0] };
};

exports.addUser = function (username = 'user') {
  return exports.addUserWithNGroups(0, username).user;
};

exports.addArticleInGroups = function (groups, uri = 'www.testuri.com') {
  const article = new Article({
    uri,
    title: `Article at ${uri}`,
    groups,
  });
  article.save(err => { if (err) throw err; });
  return article;
};

exports.addArticleInGroup = function (groupId, uri = 'www.testuri.com') {
  return exports.addArticleInGroups([groupId], uri);
};

exports.addArticleAnnotation = function (articleId, groupId, text = 'This is a test', isPublic = true) {
  const annotation = new Annotation({
    articleId,
    groupId,
    articleText: 'Article makes an interesting point.',
    text: 'This is a test.',
    isPublic,
  });
  annotation.save(err => { if (err) throw err; });
  return annotation;
};