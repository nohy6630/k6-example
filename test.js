import http from 'k6/http';
import { check, group } from 'k6';

// 테스트 설정 (성능 테스트가 아니므로 단순하게)
export const options = {
  vus: 1, // 1명의 가상 사용자
  iterations: 1, // 1번만 실행
};

const BASE_URL = 'http://localhost:3000'; // API 서버 URL (필요시 수정)

// Helper Functions
function addData(data) {
  const response = http.post(`${BASE_URL}/data/add`, JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
  return response;
}

function deleteData(data) {
  const response = http.post(`${BASE_URL}/data/delete`, JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
  });
  return response;
}

function displayData(type, id) {
  const response = http.get(`${BASE_URL}/data/display?type=${type}&id=${id}`);
  return response;
}

function checkExists(type, id, shouldExist = true) {
  const response = displayData(type, id);
  if (shouldExist) {
    return check(response, {
      [`${type}:${id} exists`]: (r) => r.status === 200 && r.json('exists') === true,
    });
  } else {
    return check(response, {
      [`${type}:${id} does not exist`]: (r) => r.status === 200 && r.json('exists') === false,
    });
  }
}

export default function () {
  // 테스트 시작 전 클린업 (선택사항)
  console.log('=== Starting API Dependency Tests ===');

  // 1. 정상 흐름 테스트
  group('Normal Flow - Add data with valid references', function () {
    // 1-1. User 추가 (최상위 데이터)
    let user1 = {
      type: 'user',
      id: 'user_001',
      name: '홍길동',
      email: 'hong@example.com',
    };
    let res = addData(user1);
    check(res, {
      'User added successfully': (r) => r.status === 200,
    });
    checkExists('user', 'user_001', true);

    // 1-2. Category 추가 (최상위 데이터)
    let category1 = {
      type: 'category',
      id: 'cat_001',
      name: '기술',
      description: '기술 관련 카테고리',
    };
    res = addData(category1);
    check(res, {
      'Category added successfully': (r) => r.status === 200,
    });
    checkExists('category', 'cat_001', true);

    // 1-3. Post 추가 (User와 Category 참조)
    let post1 = {
      type: 'post',
      id: 'post_001',
      title: 'k6 테스트 가이드',
      user_id: 'user_001',
      category_id: 'cat_001',
      content: 'k6로 API 테스트하는 방법...',
    };
    res = addData(post1);
    check(res, {
      'Post added successfully (with valid references)': (r) => r.status === 200,
    });
    checkExists('post', 'post_001', true);

    // 1-4. Comment 추가 (Post와 User 참조)
    let comment1 = {
      type: 'comment',
      id: 'comment_001',
      post_id: 'post_001',
      user_id: 'user_001',
      content: '유용한 정보 감사합니다!',
    };
    res = addData(comment1);
    check(res, {
      'Comment added successfully (with valid references)': (r) => r.status === 200,
    });
    checkExists('comment', 'comment_001', true);

    // 1-5. Tag 추가 (Post 참조)
    let tag1 = {
      type: 'tag',
      id: 'tag_001',
      post_id: 'post_001',
      name: '테스팅',
    };
    res = addData(tag1);
    check(res, {
      'Tag added successfully (with valid references)': (r) => r.status === 200,
    });
    checkExists('tag', 'tag_001', true);
  });

  // 2. 참조 데이터 없을 때 실패 시나리오
  group('Failure Flow - Add data with invalid references', function () {
    // 2-1. 존재하지 않는 user_id로 Post 추가 시도
    let invalidPost1 = {
      type: 'post',
      id: 'post_invalid_1',
      title: '잘못된 Post',
      user_id: 'user_999', // 존재하지 않는 user
      category_id: 'cat_001',
      content: '이 Post는 추가되면 안됨',
    };
    let res = addData(invalidPost1);
    check(res, {
      'Post with invalid user_id should fail': (r) => r.status !== 200 || r.json('success') === false,
    });
    checkExists('post', 'post_invalid_1', false);

    // 2-2. 존재하지 않는 category_id로 Post 추가 시도
    let invalidPost2 = {
      type: 'post',
      id: 'post_invalid_2',
      title: '잘못된 Post 2',
      user_id: 'user_001',
      category_id: 'cat_999', // 존재하지 않는 category
      content: '이 Post는 추가되면 안됨',
    };
    res = addData(invalidPost2);
    check(res, {
      'Post with invalid category_id should fail': (r) => r.status !== 200 || r.json('success') === false,
    });
    checkExists('post', 'post_invalid_2', false);

    // 2-3. 존재하지 않는 post_id로 Comment 추가 시도
    let invalidComment = {
      type: 'comment',
      id: 'comment_invalid_1',
      post_id: 'post_999', // 존재하지 않는 post
      user_id: 'user_001',
      content: '이 Comment는 추가되면 안됨',
    };
    res = addData(invalidComment);
    check(res, {
      'Comment with invalid post_id should fail': (r) => r.status !== 200 || r.json('success') === false,
    });
    checkExists('comment', 'comment_invalid_1', false);

    // 2-4. 존재하지 않는 post_id로 Tag 추가 시도
    let invalidTag = {
      type: 'tag',
      id: 'tag_invalid_1',
      post_id: 'post_999', // 존재하지 않는 post
      name: '잘못된태그',
    };
    res = addData(invalidTag);
    check(res, {
      'Tag with invalid post_id should fail': (r) => r.status !== 200 || r.json('success') === false,
    });
    checkExists('tag', 'tag_invalid_1', false);
  });

  // 3. 캐스케이드 삭제 테스트
  group('Cascade Deletion - Delete parent data and verify children are deleted', function () {
    // 3-1. 추가 테스트 데이터 준비
    let user2 = { type: 'user', id: 'user_002', name: '김철수', email: 'kim@example.com' };
    let category2 = { type: 'category', id: 'cat_002', name: '스포츠', description: '스포츠 카테고리' };
    addData(user2);
    addData(category2);

    let post2 = {
      type: 'post',
      id: 'post_002',
      title: '축구 이야기',
      user_id: 'user_002',
      category_id: 'cat_002',
      content: '축구에 대한 글',
    };
    addData(post2);

    let comment2 = {
      type: 'comment',
      id: 'comment_002',
      post_id: 'post_002',
      user_id: 'user_002',
      content: '좋은 글이네요',
    };
    addData(comment2);

    let tag2 = { type: 'tag', id: 'tag_002', post_id: 'post_002', name: '축구' };
    addData(tag2);

    // 3-2. Post 삭제 -> Comment와 Tag도 삭제되어야 함
    let res = deleteData({ type: 'post', id: 'post_002' });
    check(res, {
      'Post deleted successfully': (r) => r.status === 200,
    });
    checkExists('post', 'post_002', false);
    checkExists('comment', 'comment_002', false); // 캐스케이드 삭제 확인
    checkExists('tag', 'tag_002', false); // 캐스케이드 삭제 확인

    // 3-3. Category 삭제 전 새로운 Post 추가
    let post3 = {
      type: 'post',
      id: 'post_003',
      title: '또 다른 기술글',
      user_id: 'user_001',
      category_id: 'cat_001',
      content: '기술 관련 내용',
    };
    addData(post3);

    // 3-4. Category 삭제 -> 해당 Category의 Post도 삭제되어야 함
    res = deleteData({ type: 'category', id: 'cat_001' });
    check(res, {
      'Category deleted successfully': (r) => r.status === 200,
    });
    checkExists('category', 'cat_001', false);
    checkExists('post', 'post_001', false); // 캐스케이드 삭제 확인
    checkExists('post', 'post_003', false); // 캐스케이드 삭제 확인
    // post_001이 삭제되었으므로 comment_001과 tag_001도 삭제되어야 함
    checkExists('comment', 'comment_001', false);
    checkExists('tag', 'tag_001', false);

    // 3-5. User 삭제 -> 해당 User의 Post와 Comment도 삭제되어야 함
    // 먼저 새로운 테스트 데이터 준비
    let user3 = { type: 'user', id: 'user_003', name: '이영희', email: 'lee@example.com' };
    let category3 = { type: 'category', id: 'cat_003', name: '음악', description: '음악 카테고리' };
    addData(user3);
    addData(category3);

    let post4 = {
      type: 'post',
      id: 'post_004',
      title: '음악 추천',
      user_id: 'user_003',
      category_id: 'cat_003',
      content: '좋은 음악들',
    };
    addData(post4);

    let comment3 = {
      type: 'comment',
      id: 'comment_003',
      post_id: 'post_004',
      user_id: 'user_003',
      content: '멋진 추천이네요',
    };
    addData(comment3);

    // User 삭제
    res = deleteData({ type: 'user', id: 'user_003' });
    check(res, {
      'User deleted successfully': (r) => r.status === 200,
    });
    checkExists('user', 'user_003', false);
    checkExists('post', 'post_004', false); // 캐스케이드 삭제 확인
    checkExists('comment', 'comment_003', false); // 캐스케이드 삭제 확인
  });

  console.log('=== API Dependency Tests Completed ===');
}
