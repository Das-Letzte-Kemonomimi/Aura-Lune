use metadata::lyrics::parse_lrc_content;

#[test]
fn test_parse_lrc_content() {
    let sample = "\
[ti:Connect]
[ar:ClariS]
[00:15.20]交わした約束忘れないよ
[00:18.50]目を閉じ確かめる
[00:23.10]押し寄せた闇
";
    let lines = parse_lrc_content(sample);
    assert_eq!(lines.len(), 3);
    assert_eq!(lines[0].time_ms, 15_200);
    assert_eq!(lines[0].text, "交わした約束忘れないよ");
    assert_eq!(lines[1].time_ms, 18_500);
    assert_eq!(lines[1].text, "目を閉じ確かめる");
    assert_eq!(lines[2].time_ms, 23_100);
}
