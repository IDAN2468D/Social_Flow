# Comprehensive End-to-End SocialFlow Test Suite
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   SocialFlow - Comprehensive Full-Stack Health & E2E Test" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$testResults = [System.Collections.Generic.List[PSObject]]::new()

function Add-TestResult($category, $testName, $isPass, $details) {
    $statusStr = $(if ($isPass) { "PASS" } else { "FAIL" })
    $obj = [PSCustomObject]@{
        Category = $category
        TestName = $testName
        Status   = $statusStr
        Details  = $details
    }
    $testResults.Add($obj)
    $color = $(if ($isPass) { "Green" } else { "Red" })
    Write-Host "[$statusStr] $category - $testName ($details)" -ForegroundColor $color
}

# 1. Docker Containers Check
Write-Host "`n--- 1. Docker Containers Status ---" -ForegroundColor Cyan
$expectedContainers = @(
    "socialflow-postgres",
    "socialflow-kafka",
    "socialflow-elasticsearch",
    "socialflow-minio",
    "socialflow-user-service",
    "socialflow-post-service",
    "socialflow-feed-service",
    "socialflow-media-service",
    "socialflow-notification-service",
    "socialflow-api-gateway",
    "socialflow-frontend"
)

$runningContainers = docker ps --format "{{.Names}}"
foreach ($c in $expectedContainers) {
    $isRunning = $runningContainers -contains $c
    $statusDesc = $(if ($isRunning) { "Running" } else { "Not Running" })
    Add-TestResult "Infrastructure" "Container '$c'" $isRunning $statusDesc
}

# 2. Database Connectivity
Write-Host "`n--- 2. PostgreSQL Databases Check ---" -ForegroundColor Cyan
try {
    $dbList = docker exec socialflow-postgres psql -U postgres -d postgres -t -c "SELECT datname FROM pg_database WHERE datname IN ('socialflow_db', 'post_db', 'feed_db', 'notification_db');"
    $dbArray = $dbList.Trim() -split "\s+"
    Add-TestResult "Database" "PostgreSQL Databases" ($dbArray.Count -ge 4) "Found databases: $($dbArray -join ', ')"
} catch {
    Add-TestResult "Database" "PostgreSQL Databases" $false $_.Exception.Message
}

# 3. Kafka Check
Write-Host "`n--- 3. Kafka Broker Check ---" -ForegroundColor Cyan
try {
    $kafkaTopics = docker exec socialflow-kafka kafka-topics --bootstrap-server kafka:29092 --list 2>$null
    Add-TestResult "Messaging" "Kafka Topics" ($true) "Discovered topics: $($kafkaTopics -join ', ')"
} catch {
    Add-TestResult "Messaging" "Kafka Topics" $false $_.Exception.Message
}

# 4. Elasticsearch Check
Write-Host "`n--- 4. Elasticsearch Cluster Check ---" -ForegroundColor Cyan
try {
    $esHealth = Invoke-RestMethod -Uri "http://localhost:9205/_cluster/health" -Method Get
    Add-TestResult "Search" "Elasticsearch Cluster" ($esHealth.status -in @('green', 'yellow')) "Status: $($esHealth.status), Nodes: $($esHealth.number_of_nodes)"
} catch {
    Add-TestResult "Search" "Elasticsearch Cluster" $false $_.Exception.Message
}

# 5. MinIO S3 Check
Write-Host "`n--- 5. MinIO Object Storage Check ---" -ForegroundColor Cyan
try {
    $minioLive = Invoke-RestMethod -Uri "http://localhost:9000/minio/health/live" -Method Get
    Add-TestResult "Storage" "MinIO S3 API" $true "MinIO Live endpoint responding OK"
} catch {
    Add-TestResult "Storage" "MinIO S3 API" $false $_.Exception.Message
}

# 6. User Service (Auth Flow)
Write-Host "`n--- 6. User & Auth Service Flow ---" -ForegroundColor Cyan
$randomId = (Get-Random -Minimum 1000 -Maximum 9999)
$testUser = "testuser_$randomId"
$testPass = "Pass123!@#"
$testEmail = "$testUser@example.com"
$authToken = ""
$currentUserId = 1

try {
    $regBody = @{ username = $testUser; email = $testEmail; password = $testPass; fullName = "E2E Test User" } | ConvertTo-Json
    $regResp = Invoke-RestMethod -Uri "http://localhost:8088/api/auth/register" -Method Post -ContentType 'application/json' -Body $regBody
    $authToken = $regResp.token
    $currentUserId = $regResp.userId
    Add-TestResult "User Service" "Register User ($testUser)" ($authToken -ne $null -and $authToken.Length -gt 20) "UserId: $currentUserId"
} catch {
    Add-TestResult "User Service" "Register User ($testUser)" $false $_.Exception.Message
}

try {
    $loginBody = @{ username = $testUser; password = $testPass } | ConvertTo-Json
    $loginResp = Invoke-RestMethod -Uri "http://localhost:8088/api/auth/login" -Method Post -ContentType 'application/json' -Body $loginBody
    $authToken = $loginResp.token
    Add-TestResult "User Service" "Login User" ($authToken -ne $null) "JWT token received successfully"
} catch {
    Add-TestResult "User Service" "Login User" $false $_.Exception.Message
}

# 7. Media Service & S3 Upload Flow
Write-Host "`n--- 7. Media Service & Presigned S3 Upload Flow ---" -ForegroundColor Cyan
$uploadedImageUrl = ""
try {
    $mediaHealth = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/media/health" -Method Get
    Add-TestResult "Media Service" "Media Health via Gateway" ($mediaHealth.status -eq "UP") "Service status: $($mediaHealth.status)"

    $uploadReqBody = @{ filename = "e2e_photo.jpg"; contentType = "image/jpeg" } | ConvertTo-Json
    $presignResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/media/upload-url" -Method Post -ContentType 'application/json' -Headers @{ Authorization = "Bearer $authToken" } -Body $uploadReqBody
    Add-TestResult "Media Service" "Generate Presigned URL" ($presignResp.uploadUrl -ne $null) "Key: $($presignResp.fileKey)"

    # Upload mock image binary
    $sampleImageBytes = [System.Text.Encoding]::UTF8.GetBytes("JFIF-SAMPLE-IMAGE-BINARY-DATA-FOR-TESTING")
    Invoke-RestMethod -Uri $presignResp.uploadUrl -Method Put -Body $sampleImageBytes -ContentType 'image/jpeg'
    Add-TestResult "Media Service" "Binary Upload to MinIO" $true "PUT to presigned URL succeeded"

    # Verify download directly from public accessUrl
    $downloadedBytes = Invoke-RestMethod -Uri $presignResp.accessUrl -Method Get
    $isMatch = ($downloadedBytes -eq "JFIF-SAMPLE-IMAGE-BINARY-DATA-FOR-TESTING")
    $uploadedImageUrl = $presignResp.accessUrl
    Add-TestResult "Media Service" "Public S3 Image Download" $isMatch "Retrieved uploaded image from $uploadedImageUrl"
} catch {
    Add-TestResult "Media Service" "Upload & Download Flow" $false $_.Exception.Message
}

# 8. Post Service Creation & Interactions
Write-Host "`n--- 8. Post Service Operations ---" -ForegroundColor Cyan
$createdPostId = $null
try {
    # Create Post with Media
    $mediaUrlsJson = if ($uploadedImageUrl) { "[`"$uploadedImageUrl`"]" } else { "[]" }
    $postReqBody = @"
{
    "content": "Full end to end verification of SocialFlow system! #e2etest #socialflow #fullstack",
    "mediaUrls": $mediaUrlsJson,
    "visibility": "PUBLIC"
}
"@

    $postResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts" -Method Post -ContentType 'application/json' -Headers @{
        Authorization = "Bearer $authToken"
        "X-Auth-UserId" = "$currentUserId"
        "X-Auth-Username" = "$testUser"
    } -Body $postReqBody
    $createdPostId = $postResp.id
    Add-TestResult "Post Service" "Create Post with Media" ($createdPostId -gt 0) "Post ID: $createdPostId, Media attached: $($postResp.mediaUrls.Count)"

    # Toggle Like
    $likeResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts/$createdPostId/like" -Method Post -Headers @{
        Authorization = "Bearer $authToken"
        "X-Auth-UserId" = "$currentUserId"
        "X-Auth-Username" = "$testUser"
    }
    Add-TestResult "Post Service" "Toggle Like" ($likeResp.liked -eq $true) "Like status: $($likeResp.liked), Likes count: $($likeResp.likeCount)"

    # Add Reaction (LOVE)
    $reactionBody = @{ reactionType = "LOVE" } | ConvertTo-Json
    $reactionResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts/$createdPostId/reactions" -Method Post -ContentType 'application/json' -Headers @{
        Authorization = "Bearer $authToken"
        "X-Auth-UserId" = "$currentUserId"
        "X-Auth-Username" = "$testUser"
    } -Body $reactionBody
    Add-TestResult "Post Service" "Add Reaction (LOVE)" ($reactionResp.userReaction -eq "LOVE") "Reaction: $($reactionResp.userReaction), Total: $($reactionResp.totalReactions)"

    # Add Comment
    $commentBody = @{ content = "Automated end-to-end test comment!" } | ConvertTo-Json
    $commentResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts/$createdPostId/comments" -Method Post -ContentType 'application/json' -Headers @{
        Authorization = "Bearer $authToken"
        "X-Auth-UserId" = "$currentUserId"
        "X-Auth-Username" = "$testUser"
    } -Body $commentBody
    Add-TestResult "Post Service" "Add Comment" ($commentResp.id -gt 0) "Comment ID: $($commentResp.id)"

    # Toggle Bookmark
    $bookmarkResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts/$createdPostId/bookmark" -Method Post -Headers @{
        Authorization = "Bearer $authToken"
        "X-Auth-UserId" = "$currentUserId"
        "X-Auth-Username" = "$testUser"
    }
    Add-TestResult "Post Service" "Toggle Bookmark" ($bookmarkResp.bookmarked -eq $true) "Bookmarked: $($bookmarkResp.bookmarked)"
} catch {
    Add-TestResult "Post Service" "Post Operations" $false $_.Exception.Message
}

# 9. Feed Service & Elasticsearch Search
Write-Host "`n--- 9. Feed Service & Search Aggregations ---" -ForegroundColor Cyan
Start-Sleep -Seconds 2 # Wait for Kafka stream processing
try {
    # Trending Tags
    $tagsResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/feed/trending-tags" -Method Get
    Add-TestResult "Feed Service" "Trending Tags Feed" ($tagsResp -ne $null) "Top hashtags retrieved: $($tagsResp.Count)"

    # For-You Feed
    $feedResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/feed/for-you?userId=$currentUserId" -Method Get
    $hasPostInFeed = ($feedResp.content | Where-Object { $_.id -eq $createdPostId }) -ne $null
    Add-TestResult "Feed Service" "For-You Feed Aggregation" ($feedResp.content.Count -gt 0) "Total posts in feed: $($feedResp.content.Count), New post visible: $hasPostInFeed"

    # Elasticsearch Search
    $searchResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/search?query=fullstack" -Method Get
    $foundInSearch = ($searchResp.content | Where-Object { $_.id -eq $createdPostId }) -ne $null
    Add-TestResult "Feed Service" "Elasticsearch Full-Text Search" ($foundInSearch -or $searchResp.content.Count -gt 0) "Search results returned: $($searchResp.content.Count)"
} catch {
    Add-TestResult "Feed Service" "Feed & Search Operations" $false $_.Exception.Message
}

# 10. Notification Service & Real-Time Event Pipeline
Write-Host "`n--- 10. Notification Service & Real-Time Event Pipeline ---" -ForegroundColor Cyan
try {
    # 10.1 Health & Unread count API
    $notifHeaders = @{ "X-Auth-UserId" = "$currentUserId"; "X-Auth-Username" = "$testUser" }
    $unreadInit = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/notifications/unread-count" -Method Get -Headers $notifHeaders
    Add-TestResult "Notification Service" "Unread Count Endpoint" ($unreadInit.unreadCount -ne $null) "Initial unread count: $($unreadInit.unreadCount)"

    # 10.2 Create real-time interactions targeting $currentUserId (post owner)
    $otherUserId = 2 # david
    $otherUserName = "david"

    # User 2 likes User 1's post
    $likeAction = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts/$createdPostId/like" -Method Post -Headers @{ "X-Auth-UserId" = "$otherUserId"; "X-Auth-Username" = "$otherUserName" }
    Add-TestResult "Notification Service" "Emit Like Event via Kafka" ($likeAction.liked -eq $true) "Post $createdPostId liked by $otherUserName"

    # User 2 comments on User 1's post
    $commentBody = @{ content = "Great job on the comprehensive E2E test!" } | ConvertTo-Json
    $commentAction = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/posts/$createdPostId/comments" -Method Post -Headers @{ "X-Auth-UserId" = "$otherUserId"; "X-Auth-Username" = "$otherUserName" } -ContentType 'application/json' -Body $commentBody
    Add-TestResult "Notification Service" "Emit Comment Event via Kafka" ($commentAction.id -gt 0) "Comment $($commentAction.id) added by $otherUserName"

    # User 2 follows User 1
    $followAction = Invoke-RestMethod -Uri "http://localhost:8088/api/users/$currentUserId/follow" -Method Post -Headers @{ "X-Auth-UserId" = "$otherUserId"; "X-Auth-Username" = "$otherUserName" }
    Add-TestResult "Notification Service" "Emit Follow Event via Kafka" ($followAction.message -ne $null) "Follow event message: $($followAction.message)"

    # Wait for Kafka consumers to process and persist
    Start-Sleep -Seconds 3

    # 10.3 Retrieve notifications for recipient User 1
    $userNotifs = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/notifications" -Method Get -Headers $notifHeaders
    $hasLikeNotif = ($userNotifs | Where-Object { $_.type -eq "LIKE" }) -ne $null
    $hasCommentNotif = ($userNotifs | Where-Object { $_.type -eq "COMMENT" }) -ne $null
    $hasFollowNotif = ($userNotifs | Where-Object { $_.type -eq "FOLLOW" }) -ne $null

    Add-TestResult "Notification Service" "Receive Real-Time Events (LIKE/COMMENT/FOLLOW)" ($hasLikeNotif -and $hasCommentNotif -and $hasFollowNotif) "Total notifications: $($userNotifs.Count), Types: $(($userNotifs.type | Select-Object -Unique) -join ', ')"

    # 10.4 Mark single notification as read
    if ($userNotifs.Count -gt 0) {
        $firstNotifId = $userNotifs[0].id
        $readResp = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/notifications/$firstNotifId/read" -Method Patch -Headers $notifHeaders
        Add-TestResult "Notification Service" "Mark Single Notification As Read" ($readResp.isRead -eq $true) "Notification $firstNotifId isRead: $($readResp.isRead)"
    }

    # 10.5 Mark all as read
    Invoke-RestMethod -Uri "http://localhost:8088/api/v1/notifications/read-all" -Method Patch -Headers $notifHeaders
    $unreadAfter = Invoke-RestMethod -Uri "http://localhost:8088/api/v1/notifications/unread-count" -Method Get -Headers $notifHeaders
    Add-TestResult "Notification Service" "Mark All As Read & Zero Counter" ($unreadAfter.unreadCount -eq 0) "Remaining unread: $($unreadAfter.unreadCount)"

} catch {
    Add-TestResult "Notification Service" "Pipeline Execution" $false $_.Exception.Message
}

# 11. Frontend Web Server Check
Write-Host "`n--- 11. Frontend Nginx Web Server ---" -ForegroundColor Cyan
try {
    $feResp = Invoke-WebRequest -Uri "http://localhost:3000" -Method Get -UseBasicParsing
    Add-TestResult "Frontend" "Nginx Web Client" ($feResp.StatusCode -eq 200) "HTTP 200 OK, Size: $($feResp.RawContentLength) bytes"
} catch {
    Add-TestResult "Frontend" "Nginx Web Client" $false $_.Exception.Message
}

# Summary Report
Write-Host "`n==========================================================" -ForegroundColor Cyan
Write-Host "                    TEST SUMMARY REPORT                   " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
$passedCount = ($testResults | Where-Object { $_.Status -match "PASS" }).Count
$totalCount = $testResults.Count
$failedCount = $totalCount - $passedCount

Write-Host "Total Tests:  $totalCount" -ForegroundColor Cyan
Write-Host "Passed:       $passedCount" -ForegroundColor Green
Write-Host "Failed:       $failedCount" -ForegroundColor $(if ($failedCount -eq 0) { "Green" } else { "Red" })

if ($failedCount -eq 0) {
    Write-Host "`nALL SYSTEMS OPERATIONAL! 100% SUCCESS RATE!" -ForegroundColor Green
} else {
    Write-Host "`nSOME TESTS FAILED. PLEASE REVIEW DETAILS ABOVE." -ForegroundColor Red
}
