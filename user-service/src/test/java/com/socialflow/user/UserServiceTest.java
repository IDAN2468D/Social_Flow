package com.socialflow.user;

import com.socialflow.user.controller.UserController;
import com.socialflow.user.dto.UpdateProfileRequest;
import com.socialflow.user.dto.UserProfileDto;
import com.socialflow.user.event.UserFollowedEvent;
import com.socialflow.user.model.Follower;
import com.socialflow.user.model.User;
import com.socialflow.user.repository.FollowerRepository;
import com.socialflow.user.repository.UserRepository;
import com.socialflow.user.service.UserEventProducer;
import com.socialflow.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private FollowerRepository followerRepository;

    @Mock
    private UserEventProducer eventProducer;

    @InjectMocks
    private UserService userService;

    private User actingUser;
    private User targetUser;

    @BeforeEach
    void setUp() {
        actingUser = new User("idan", "idan@example.com", "encoded", "Idan Kazam");
        actingUser.setId(1L);

        targetUser = new User("noa", "noa@example.com", "encoded", "Noa Levi");
        targetUser.setId(2L);
    }

    @Test
    void testFollowUserByUsername() {
        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(actingUser));
        when(userRepository.findByUsername("noa")).thenReturn(Optional.of(targetUser));
        when(followerRepository.existsByFollowerIdAndFollowingId(1L, 2L)).thenReturn(false);

        userService.followUser("noa", "idan");

        verify(followerRepository, times(1)).save(any(Follower.class));
        ArgumentCaptor<UserFollowedEvent> eventCaptor = ArgumentCaptor.forClass(UserFollowedEvent.class);
        verify(eventProducer, times(1)).emitUserFollowed(eventCaptor.capture());
        assertEquals(1L, eventCaptor.getValue().getFollowerId());
        assertEquals("idan", eventCaptor.getValue().getFollowerUsername());
        assertEquals(2L, eventCaptor.getValue().getFollowingId());
        assertTrue(eventCaptor.getValue().isFollow());
    }

    @Test
    void testFollowUserByNumericIdString() {
        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(actingUser));
        when(userRepository.findById(2L)).thenReturn(Optional.of(targetUser));
        when(followerRepository.existsByFollowerIdAndFollowingId(1L, 2L)).thenReturn(false);

        userService.followUser("2", "idan");

        verify(followerRepository, times(1)).save(any(Follower.class));
        verify(eventProducer, times(1)).emitUserFollowed(any(UserFollowedEvent.class));
    }

    @Test
    void testFollowSelfByUsernameThrowsException() {
        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(actingUser));

        assertThrows(IllegalArgumentException.class, () -> userService.followUser("idan", "idan"));
        verify(followerRepository, never()).save(any());
    }

    @Test
    void testUnfollowUserByUsername() {
        Follower existing = new Follower(1L, 2L);
        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(actingUser));
        when(userRepository.findByUsername("noa")).thenReturn(Optional.of(targetUser));
        when(followerRepository.findByFollowerIdAndFollowingId(1L, 2L)).thenReturn(Optional.of(existing));

        userService.unfollowUser("noa", "idan");

        verify(followerRepository, times(1)).delete(existing);
        ArgumentCaptor<UserFollowedEvent> eventCaptor = ArgumentCaptor.forClass(UserFollowedEvent.class);
        verify(eventProducer, times(1)).emitUserFollowed(eventCaptor.capture());
        assertFalse(eventCaptor.getValue().isFollow());
        assertEquals(2L, eventCaptor.getValue().getFollowingId());
    }

    @Test
    void testUpdateProfileSuccess() {
        UpdateProfileRequest request = new UpdateProfileRequest();
        request.setFullName("עידן קזם");
        request.setBio("Fullstack & Cloud Architect");
        request.setProfileImageUrl("https://example.com/avatar.png");

        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(actingUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));
        when(followerRepository.countByFollowingId(1L)).thenReturn(15L);
        when(followerRepository.countByFollowerId(1L)).thenReturn(8L);

        UserProfileDto dto = userService.updateProfile("idan", request);

        assertNotNull(dto);
        assertEquals("עידן קזם", dto.getFullName());
        assertEquals("Fullstack & Cloud Architect", dto.getBio());
        assertEquals("https://example.com/avatar.png", dto.getProfileImageUrl());
        assertEquals(15L, dto.getFollowersCount());
        assertEquals(8L, dto.getFollowingCount());
        verify(userRepository, times(1)).save(actingUser);
    }

    @Test
    void testSearchUsers() {
        when(userRepository.findByUsername("idan")).thenReturn(Optional.of(actingUser));
        when(userRepository.findByUsernameContainingIgnoreCaseOrFullNameContainingIgnoreCase("noa", "noa"))
                .thenReturn(List.of(targetUser));
        when(followerRepository.countByFollowingId(2L)).thenReturn(5L);
        when(followerRepository.countByFollowerId(2L)).thenReturn(3L);
        when(followerRepository.existsByFollowerIdAndFollowingId(1L, 2L)).thenReturn(true);

        List<UserProfileDto> results = userService.searchUsers("noa", "idan");

        assertEquals(1, results.size());
        assertEquals("noa", results.get(0).getUsername());
        assertTrue(results.get(0).isFollowedByCurrentUser());
    }

    @Test
    void testControllerHeaderFallbackAndAuthValidation() {
        UserService mockedService = mock(UserService.class);
        UserController controller = new UserController(mockedService);

        ResponseEntity<Map<String, String>> followRes = controller.followUser("noa", null, "idan", null);
        assertEquals(HttpStatus.OK, followRes.getStatusCode());
        verify(mockedService, times(1)).followUser("noa", "idan");

        ResponseEntity<Map<String, String>> unfollowRes = controller.unfollowUser("noa", null, null, "idan");
        assertEquals(HttpStatus.OK, unfollowRes.getStatusCode());
        verify(mockedService, times(1)).unfollowUser("noa", "idan");

        ResponseStatusException unauthEx = assertThrows(ResponseStatusException.class,
                () -> controller.followUser("noa", null, null, null));
        assertEquals(HttpStatus.UNAUTHORIZED, unauthEx.getStatusCode());

        UpdateProfileRequest updateReq = new UpdateProfileRequest();
        updateReq.setFullName("Idan Updated");
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                "idan", null, List.of(new SimpleGrantedAuthority("ROLE_USER")));
        ResponseStatusException forbiddenEx = assertThrows(ResponseStatusException.class,
                () -> controller.updateProfile("noa", updateReq, auth, null, null));
        assertEquals(HttpStatus.FORBIDDEN, forbiddenEx.getStatusCode());

        UserProfileDto updatedDto = new UserProfileDto();
        updatedDto.setUsername("idan");
        updatedDto.setFullName("Idan Updated");
        when(mockedService.updateProfile("idan", updateReq)).thenReturn(updatedDto);

        ResponseEntity<UserProfileDto> ownUpdateRes = controller.updateProfile("idan", updateReq, auth, null, null);
        assertEquals(HttpStatus.OK, ownUpdateRes.getStatusCode());
        assertEquals("Idan Updated", ownUpdateRes.getBody().getFullName());

        AnonymousAuthenticationToken anon = new AnonymousAuthenticationToken(
                "key", "anonymousUser", List.of(new SimpleGrantedAuthority("ROLE_ANONYMOUS")));
        ResponseEntity<UserProfileDto> anonHeaderUpdate = controller.updateProfile(null, updateReq, anon, "idan", null);
        assertEquals(HttpStatus.OK, anonHeaderUpdate.getStatusCode());
        verify(mockedService, times(2)).updateProfile("idan", updateReq);

        UsernamePasswordAuthenticationToken adminAuth = new UsernamePasswordAuthenticationToken(
                "adminUser", null, List.of(new SimpleGrantedAuthority("ROLE_ADMIN")));
        UserProfileDto noaUpdated = new UserProfileDto();
        noaUpdated.setUsername("noa");
        noaUpdated.setFullName("Updated By Admin");
        when(mockedService.updateProfile("noa", updateReq)).thenReturn(noaUpdated);
        ResponseEntity<UserProfileDto> adminUpdateRes = controller.updateProfile("noa", updateReq, adminAuth, null, null);
        assertEquals(HttpStatus.OK, adminUpdateRes.getStatusCode());
        assertEquals("noa", adminUpdateRes.getBody().getUsername());
    }

    @Test
    void testAdminUpdateUserRole() {
        when(userRepository.findByUsername("noa")).thenReturn(Optional.of(targetUser));
        when(userRepository.save(any(User.class))).thenAnswer(inv -> inv.getArgument(0));

        UserProfileDto promoted = userService.updateUserRole("noa", "ADMIN");
        assertEquals("ADMIN", promoted.getRole());

        assertThrows(IllegalArgumentException.class, () -> userService.updateUserRole("noa", "SUPERUSER"));
    }
}
