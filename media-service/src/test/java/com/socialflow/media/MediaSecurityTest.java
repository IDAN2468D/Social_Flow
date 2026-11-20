package com.socialflow.media;

import com.socialflow.media.config.JwtAuthenticationFilter;
import com.socialflow.media.config.SecurityConfig;
import com.socialflow.media.config.UserPrincipal;
import com.socialflow.media.controller.GlobalExceptionHandler;
import com.socialflow.media.controller.MediaController;
import com.socialflow.media.dto.UploadUrlRequest;
import com.socialflow.media.dto.UploadUrlResponse;
import com.socialflow.media.service.MediaService;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.io.Decoders;
import io.jsonwebtoken.security.Keys;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.SecretKey;
import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = MediaController.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, GlobalExceptionHandler.class})
class MediaSecurityTest {

    private static final String SECRET = "404E635266556A586E3272357538782F413F4428472B4B6250645367566B5970";

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private MediaService mediaService;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    private String mintJwt(Long userId, String username, String role) {
        SecretKey key = Keys.hmacShaKeyFor(Decoders.BASE64.decode(SECRET));
        return Jwts.builder()
                .claims(Map.of("userId", userId, "role", role))
                .subject(username)
                .issuedAt(new Date())
                .expiration(new Date(System.currentTimeMillis() + 60000))
                .signWith(key)
                .compact();
    }

    @Test
    @DisplayName("GET /api/v1/media/health remains publicly accessible")
    void healthEndpointIsPublic() throws Exception {
        mockMvc.perform(get("/api/v1/media/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));
    }

    @Test
    @DisplayName("Unauthenticated requests to media routes return 401 instead of falling back to user 1L")
    void unauthenticatedRequestsReturn401() throws Exception {
        mockMvc.perform(get("/api/v1/media"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/v1/media/upload-url")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"filename\":\"pic.png\",\"contentType\":\"image/png\"}"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(delete("/api/v1/media").param("key", "uploads/1/pic.png"))
                .andExpect(status().isUnauthorized());

        verifyNoInteractions(mediaService);
    }

    @Test
    @DisplayName("Authenticated JWT user can request upload URL and delete own media")
    void authenticatedJwtUserSucceeds() throws Exception {
        String token = mintJwt(42L, "idan", "USER");
        when(mediaService.generateUploadUrl(eq(42L), any(UploadUrlRequest.class)))
                .thenReturn(new UploadUrlResponse("uploads/42/a.png", "http://minio/put", "http://minio/get"));

        mockMvc.perform(post("/api/v1/media/upload-url")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"filename\":\"a.png\",\"contentType\":\"image/png\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileKey").value("uploads/42/a.png"));

        verify(mediaService).generateUploadUrl(eq(42L), any(UploadUrlRequest.class));
    }

    @Test
    @DisplayName("ADMIN JWT role propagates to MediaService.listUserMedia")
    void adminJwtPropagatesAdminFlag() throws Exception {
        String adminToken = mintJwt(7L, "admin", "ADMIN");
        when(mediaService.listUserMedia(7L, true, true))
                .thenReturn(Map.of("userId", 7L, "totalUploaded", 0, "files", List.of()));

        mockMvc.perform(get("/api/v1/media")
                        .param("all", "true")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.userId").value(7));

        verify(mediaService).listUserMedia(7L, true, true);
    }

    @Test
    @DisplayName("Direct MediaController call without identity throws 401 instead of 1L fallback")
    void controllerDirectlyThrows401WithoutIdentity() {
        MediaController controller = new MediaController(mediaService, SECRET);

        assertThatThrownBy(() -> controller.listMyMedia(false, null, null, null, null, null))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));

        assertThatThrownBy(() -> controller.getUploadUrl(null, null, null, null, new UploadUrlRequest("a.png", "image/png")))
                .isInstanceOf(ResponseStatusException.class)
                .satisfies(ex -> assertThat(((ResponseStatusException) ex).getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
    }

    @Test
    @DisplayName("JwtAuthenticationFilter rejects invalid JWT even if X-User-Id header is also sent")
    void invalidJwtDoesNotFallBackToSpoofedHeaders() throws Exception {
        JwtAuthenticationFilter filter = new JwtAuthenticationFilter(SECRET);
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/media");
        request.addHeader("Authorization", "Bearer invalid.token");
        request.addHeader("X-Auth-UserId", "1");
        request.addHeader("X-User-Role", "ADMIN");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        assertThat(auth).isNull();
    }

    @Test
    @DisplayName("Valid USER JWT with spoofed X-User-Role: ADMIN header cannot escalate to admin on list or delete")
    void userJwtWithSpoofedAdminHeaderCannotEscalate() throws Exception {
        String userToken = mintJwt(42L, "idan", "USER");
        when(mediaService.listUserMedia(42L, true, false))
                .thenReturn(Map.of("userId", 42L, "totalUploaded", 0, "files", List.of()));

        mockMvc.perform(get("/api/v1/media")
                        .param("all", "true")
                        .header("Authorization", "Bearer " + userToken)
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isOk());

        verify(mediaService).listUserMedia(42L, true, false);
        verify(mediaService, never()).listUserMedia(42L, true, true);

        mockMvc.perform(delete("/api/v1/media")
                        .param("key", "uploads/99/other.png")
                        .header("Authorization", "Bearer " + userToken)
                        .header("X-User-Role", "ADMIN"))
                .andExpect(status().isNoContent());

        verify(mediaService).deleteMedia(42L, false, "uploads/99/other.png");
        verify(mediaService, never()).deleteMedia(42L, true, "uploads/99/other.png");
    }
}
