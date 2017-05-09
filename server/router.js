import { Router } from 'express';
import * as Users from './controllers/user_controller';
import * as Articles from './controllers/article_controller';
import * as Annotations from './controllers/annotation_controller';
import * as Groups from './controllers/group_controller';
import { getFriendsLinkShares } from './explore.js';
import config from './_config';


import util from './util';

const router = Router();

// TODO: Deal with errors like goddamn adults instead of ignoring them
// TODO: Make style more consistent across all the endpoints
// TODO: More validation of things existing before adding/doing stuff with them
// TODO: How to do context stuff

/* RESPONSES
  POST -> {success: {stuff just posted}}
  GET -> {stuff requested}
  DELETE -> {success}
*/

// Routes for Explore Related Endpoints

// route to post user exploreNumber
router.post('/api/user/exploreNumber', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    const explore_num = req.body.explore;
    User.postUserExploreNumber(user, explore_num)
    .then((result) => {
      util.returnPostSuccess(res, result);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    res.status(401).end();
  }
});

// route to update user exploreNumber
router.put('/api/user/exploreNumber'), (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    const explore_num = req.body.explore;
    User.updateUserExploreNumber(user, explore_num)
    .then((result) => {
      util.returnPostSuccess(res, result);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    res.status(401).end();
  }
};

// route to update article avgUserScore
router.put('/api/article/userScore'), (req, res) => {
  if (req.isAuthenticated()) {
    const article = req.body.article;
    const value = req.body.value;
    Article.updateArticleScore(article, value)
    .then((result) => {
      util.returnPostSuccess(res, result);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    res.status(401).end();
  }
};


// navigate to logout page
router.get('/logout', (req, res) => {
  req.logout();
  req.session.destroy();
  res.redirect(`${config.frontEndHost}/login`);
});

/*
Create a new article.
Input:
  req.body.uri: String uri of the article
  req.body.groups: Array of String group IDs to which article belongs
Output: Returns json file with the created article or error.
*/
router.post('/api/article', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;

    if (!user.isMemberOfAll(req.body.groups)) {
      util.returnError(res, new Error('User not authorized to add article to one or more groups'));
      return;
    }

    Articles.createArticle(req.body.uri, req.body.groups)
    .then((result) => {
      util.returnPostSuccess(res, result);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    // send 401 unauthorized
    res.status(401).end();
  }
});

router.get('/api/user', (req, res) => {
  if (req.isAuthenticated()) {
    // populate the user's groups
    req.user.populate('groups')
    .execPopulate()
    .then((user) => {
      util.returnGetSuccess(res, user);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    res.status(401).end();
  }
});

/*
Create a new group.
Input:
  req.body.name: String name of the group
  req.body.description: String description of the group
  req.body.isPersonal: (false) Whether this is a personal group
  req.body.isPublic: (false) Whether this is a public group (ignored if isPersonal is true)
Output: Returns json file with the created group or error.
*/
router.post('/api/group', (req, res) => {
  if (req.isAuthenticated()) {
    const isPersonal = req.body.isPersonal || false;
    const isPublic = !isPersonal && (req.body.isPublic || false);
    Groups.createGroup(req.body.name, req.body.description, req.user._id, isPersonal, isPublic)
    .then((createdGroup) => {
      Users.addUserGroup(req.user._id, createdGroup._id)
      .then((updateResult) => {
        util.returnPostSuccess(res, createdGroup);
      });
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    // send 401 unauthorized
    res.status(401).end();
  }
});

/*
Get a specific group.
Input:
  req.params.id: String ID of the group
Output: Returns json file with the group information or error.
*/
// TODO: Clarify the point of this endpoint, should it get all the articles or
// annotations, or be like a history/info about the group?
router.get('/api/group/:id', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    const groupId = req.params.id;
    const isMember = user.isMemberOf(groupId);
    Groups.getGroup(groupId)
    .then((group) => {
      if (group === null) {
        throw new Error('Group not found');
      } else if (!isMember && !group.isPublic) {
        throw new Error('Not a member of this private group');
      } else {
        util.returnGetSuccess(res, group);
      }
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    res.status(401).end();
  }
});

/*
Add a user to a specific group as a member.
Input:
  req.params.groupId: String group ID
  req.params.userId: String user ID to be added to the group.
Output: Returns json file with the updated group information.
*/
router.post('/api/group/:groupId/user/:userId', (req, res) => {
  const groupId = req.params.groupId;
  const userId = req.params.userId;
  if (req.isAuthenticated() && req.user.isMemberOf(groupId)) {
    Users.addUserGroup(userId, groupId)
    .then((updatedUser) => {
      return Groups.addGroupMember(groupId, userId);
    })
    .then((updatedGroup) => {
      util.returnPostSuccess(res, updatedGroup);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    res.status(401).end();
  }
});

/*
Get the members of a group.
Input:
  req.params.groupId: String group ID
Output: Returns json list of members of the group.
*/
router.get('/api/group/:groupId/members', (req, res) => {
  Groups.getMembers(req.params.groupId)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Get the articles of a group.
Input:
  req.params.groupId: String group ID
Output: Returns json list of articles of the group.

NOTE: user is not validated here because assumption is that this call is made
on navigating to this group, which is only possible if user can see group
*/
router.get('/api/group/:groupId/articles', (req, res) => {
  Groups.getGroupArticles(req.params.groupId)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});


/*
Get articles posted in a group as pages. Request should include query:
  limit: number of items per page
  page: number of page to be loaded (starting at 0)
  sort: field to sort on, must be field on Article model
  sort_dir: direction to sort in, -1 for decreasing, 1 for increasing
*/
router.get('/api/group/:groupId/articles/paginated', (req, res) => {
  const conditions = { pagination: {}, sort: {} };

  // defaults
  let limit = Number.parseInt(req.query.limit, 10);
  if (!limit || limit < 0) {
    limit = 50;
  }
  let page = Number.parseInt(req.query.page, 10);
  if (!page || page < 0) {
    page = 0;
  }
  let direction = Number.parseInt(req.query.sort_dir, 10);
  if (!(direction === 1 || direction === -1)) {
    direction = -1;
  }

  conditions.pagination.limit = limit;
  conditions.pagination.skip = limit * page;
  if (typeof(req.query.sort) === 'string') {
    conditions.sort[req.query.sort] = direction;
  }

  Groups.getGroupArticlesPaginated(req.params.groupId, conditions)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Create a new annotation.
Input:
  req.body.groups: Array of String group IDs
  req.body.uri: String uri of the annotation's article
  req.body.articleText: String of the article's relevant text
  req.body.text: String of the annotation text
  req.body.parent: null or String of the parent's annotation ID
  req.body.isPublic: boolean of whether the annotation will be publicly visible
Output: Returns json file of the new annotation or error.
*/
// TODO: Should createAnnotation take in body or better to parse out all the params here?
// TODO: Parents should keep track of children in the level directly below
router.post('/api/annotation', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    const body = req.body;

    Articles.getArticle(req.body.uri)
    .then((article) => {
      if (article == null) {
        return Articles.createArticle(req.body.uri, req.body.groups);
      } else {
        return article;
      }
    })
    .then((article) => {
      return Annotations.createAnnotation(user, body, article._id);
    })
    .then((annotation) => {
      util.returnPostSuccess(res, annotation);
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else { // req unathenticated so send 401 error
    res.status(401).end();
  }
});

// TODO: endpoint to get top level annotations & level 1 child

/*
Get annotations of an article
Input:
  req.query.uri: URI of article
Output: Returns json file of the article's annotations or error.
*/

router.get('/api/article/annotations', (req, res) => {
  let user = null;
  const topLevelOnly = req.query.toplevel;
  if (req.isAuthenticated()) {
    user = req.user;
  }

  const articleURI = req.query.uri;
  Articles.getArticleAnnotations(user, articleURI, topLevelOnly)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

router.get('/api/article/annotations/paginated', (req, res) => {
  let user = null;
  const conditions = { query: {}, pagination: {} };

  conditions.topLevelOnly = req.query.toplevel;
  conditions.query.article = req.query.article;

  if (req.isAuthenticated()) {
    user = req.user;
  }

  if (user === null) {
    conditions.query.isPublic = true;
  } else {
    conditions.query.$or = [{ groups: { $in: user.groups } },
                            { isPublic: true },
                            { author: user._id }];
  }

  if (req.query.limit) {
    conditions.pagination.limit = req.query.limit * 1;
  }

  if (req.query.last) {
    conditions.pagination.last = req.query.last;
  }

  if (req.query.sort) {
    conditions.pagination.sort = req.query.sort; // TODO: assumption is always decreasing order right now
  }

  Articles.getArticleAnnotationsPaginated(user, conditions)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Get number of annotations and replies of an article
Input:
  req.body.uri: URI of article
Output: Returns number of the annotations and replies
*/
router.get('/api/article/annotations/count', (req, res) => {
  let user = null;
  if (req.isAuthenticated()) {
    user = req.user;
  }
  const articleURI = req.query.uri;
  Articles.getArticleReplyNumber(user, articleURI)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Get specific annotation.
Input:
  req.params.id: String annotation ID
Output: Returns json file of the annotation or error.
*/
router.get('/api/annotation/:id', (req, res) => {
  let user = null;
  if (req.isAuthenticated()) {
    user = req.user;
  }
  const annotationId = req.params.id;
  Annotations.getAnnotation(user, annotationId)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Get replies to an annotation
Input:
  req.params.id: String annotation ID
Output: Returns json file of the annotation's replies or error.
*/
router.get('/api/annotation/:id/replies', (req, res) => {
  let user = null;
  if (req.isAuthenticated()) {
    user = req.user;
  }
  const annotationId = req.params.id;
  Annotations.getReplies(user, annotationId)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Get replies to an annotation
Input:
  req.params.id: String annotation ID
Output: Returns json file of the annotation's replies or error.
*/
router.get('/api/annotation/:id/replies/all', (req, res) => {
  let user = null;
  if (req.isAuthenticated()) {
    user = req.user;
  }
  const annotationId = req.params.id;
  Annotations.getAnnotationReplies(user, annotationId)
  .then((result) => {
    util.returnGetSuccess(res, result);
  })
  .catch((err) => {
    util.returnError(res, err);
  });
});

/*
Edit specific annotation.
Input:
  req.params.id: String annotation ID
Output: Returns json file of the edited annotation or error.
*/
router.post('/api/annotation/:id/edit', (req, res) => {
  if (req.isAuthenticated()) {
    const user = req.user;
    const annotationId = req.params.id;
    const updateText = req.body.text;
    Annotations.editAnnotation(user, annotationId, updateText)
    .then((result) => {
      if (result === null) {
        // either the annotation doesn't exist or wasn't written by this user
        throw new Error('Annotation not found');
      } else {
        util.returnPostSuccess(res, result);
      }
    })
    .catch((err) => {
      util.returnError(res, err);
    });
  } else {
    // send 401 unauthorized
    res.status(401).end();
  }
});

router.delete('/api/annotation/:id', (req, res) => {
  if (req.isAuthenticated()) {
    const annotationId = req.params.id;
    Annotations.deleteAnnotation(req.user, annotationId)
      .then((result) => {
        util.returnPostSuccess(res, true);
      })
      .catch((err) => {
        util.returnError(res, err);
      });
  } else {
    res.status(401).end();
  }
});

export default router;
